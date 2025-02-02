import asyncio
import json
import os
import threading
import tkinter as tk
from dataclasses import dataclass, field
from typing import List
from dotenv import load_dotenv
load_dotenv()

from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIModel
from PIL import Image, ImageTk

# -----------------------------------------------------------------------------
# Data Models & Dependencies
# -----------------------------------------------------------------------------
@dataclass
class MenuItem:
    id: int
    name: str
    ingredients: List[str]
    price: float

@dataclass
class OrderItem:
    product: MenuItem
    special_instructions: str = "none"  # Default if not provided

@dataclass
class RestaurantDeps:
    menu: List[MenuItem]
    # In-memory storage for the current order; list of OrderItem.
    current_order: dict = field(default_factory=lambda: {"items": []})

# -----------------------------------------------------------------------------
# GUI Window for the Current Order
# -----------------------------------------------------------------------------
class OrderWindow:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Current Order")
        self.root.minsize(300, 200)
        self.frame = tk.Frame(self.root)
        self.frame.pack(fill=tk.BOTH, expand=True)
    
    def update_order_display(self, current_order):
    # Clear existing contents.
        for widget in self.frame.winfo_children():
            widget.destroy()
        
        # Supported image extensions
        image_extensions = ["png", "jpg", "jpeg", "webp", "gif"]

        # For each order item, create a row.
        for order_item in current_order["items"]:
            row = tk.Frame(self.frame, borderwidth=1, relief=tk.RIDGE)
            row.pack(fill=tk.X, padx=5, pady=5)
            
            photo = None  # Initialize the image variable

            # Try to load the image file with different extensions
            for ext in image_extensions:
                try:
                    with Image.open(f"{order_item.product.id}.{ext}") as img:
                        img.thumbnail((100, 100))  # Resize while maintaining aspect ratio.
                        photo = ImageTk.PhotoImage(img)
                        break  # Exit the loop once an image is successfully loaded
                except Exception:
                    continue

            # If no image was loaded (photo is still None), create a blank image.
            if not photo:
                photo = tk.PhotoImage(width=100, height=100)

            img_label = tk.Label(row, image=photo)
            img_label.image = photo  # Keep a reference.
            img_label.pack(side=tk.LEFT, padx=5)
            
            # Label for name and price.
            text = f"{order_item.product.name} - ${order_item.product.price:.2f}"
            text_label = tk.Label(row, text=text, font=("Arial", 12))
            text_label.pack(side=tk.LEFT, padx=10)

            # If special instructions are provided (and not "none"), display them.
            if order_item.special_instructions.lower() != "none" and order_item.special_instructions.strip() != "":
                instr_label = tk.Label(row, text=f"Instructions: {order_item.special_instructions}",
                                    font=("Arial", 10), fg="blue")
                instr_label.pack(side=tk.LEFT, padx=10)

        self.root.update_idletasks()


    def show_final_message(self, order_number):
        # Clear the window and show a final thank-you message with the order number.
        for widget in self.frame.winfo_children():
            widget.destroy()
        final_label = tk.Label(self.frame,
                               text=f"THANKS! Your order number is {order_number}",
                               font=("Arial", 16), fg="green")
        final_label.pack(expand=True)
        self.root.update_idletasks()

    def start(self):
        self.root.mainloop()

# Global instance of the OrderWindow.
ORDER_WINDOW = OrderWindow()


api_key = os.getenv("OPENAI_API_KEY")

# Ensure API key is available
if not api_key:
    raise ValueError("API key not found. Please set OPENAI_API_KEY in your .env file.")
# -----------------------------------------------------------------------------
# Model & Agent Initialization
# -----------------------------------------------------------------------------
model = OpenAIModel(
    'gpt-4o-mini',
    api_key=api_key
)

agent = Agent(
    model,
    system_prompt="""You are a restaurant assistant. Here is our menu:
{menu_details}

Answer any questions about our menu (including ingredients and price) accurately.
When a customer wants to order, use the tool 'update_order' to add items (by their id) to their order along with any special instructions.
If a customer wants to remove an item, use 'remove_order_item' to remove it from their order.
Always ask if they want something else, and only when the customer says they are done, call 'place_order' to finalize the order and provide the order number."""
)

# -----------------------------------------------------------------------------
# Dynamic System Prompt: Filling in the Menu Details
# -----------------------------------------------------------------------------
@agent.system_prompt
async def fill_menu_details(ctx: RunContext[RestaurantDeps]) -> str:
    menu_lines = [
        f"{item.id} - {item.name}: {', '.join(item.ingredients)} - ${item.price:.2f}"
        for item in ctx.deps.menu
    ]
    menu_details = "\n".join(menu_lines)
    return (
        f"You are a restaurant assistant. Here is our menu:\n{menu_details}\n\n"
        "Answer any questions about our menu accurately. "
        "When a customer wants to order, use 'update_order' to add items (by their id) along with any special instructions. "
        "If a customer wants to remove an item, use 'remove_order_item'. "
        "Always ask if they want something else, and only when the customer says they are done, call 'place_order' "
        "to finalize the order and provide the order number."
    )

# -----------------------------------------------------------------------------
# Tool: update_order
# -----------------------------------------------------------------------------
@agent.tool
async def update_order(ctx: RunContext[RestaurantDeps], order_item_ids: List[int], special_instructions: str = "") -> str:
    """
    For each product id provided:
      - If an order item for that product already exists in the current order, update its special instructions if new instructions are provided.
      - Otherwise, add a new order item with the product and its special instructions (defaulting to "none" if not provided).
    Then update the GUI window and return a JSON recap of the current order.
    """
    for prod_id in order_item_ids:
        product = next((p for p in ctx.deps.menu if p.id == prod_id), None)
        if product:
            existing_item = next((oi for oi in ctx.deps.current_order["items"] if oi.product.id == prod_id), None)
            if existing_item:
                # If special_instructions provided, update it.
                if special_instructions.strip():
                    existing_item.special_instructions = special_instructions
            else:
                # Add new order item.
                instructions = special_instructions if special_instructions.strip() else "none"
                ctx.deps.current_order["items"].append(OrderItem(product=product, special_instructions=instructions))
    # Update the GUI window.
    ORDER_WINDOW.root.after(0, ORDER_WINDOW.update_order_display, ctx.deps.current_order)
    recap = {
        "items": [
            {"id": oi.product.id, "name": oi.product.name, "price": oi.product.price, "special_instructions": oi.special_instructions}
            for oi in ctx.deps.current_order["items"]
        ]
    }
    return json.dumps(recap, indent=2)

# -----------------------------------------------------------------------------
# Tool: remove_order_item
# -----------------------------------------------------------------------------
@agent.tool
async def remove_order_item(ctx: RunContext[RestaurantDeps], order_item_ids: List[int]) -> str:
    """
    Remove the first occurrence of each provided product id from the current order.
    Update the GUI and return a JSON recap.
    """
    for prod_id in order_item_ids:
        for idx, oi in enumerate(ctx.deps.current_order["items"]):
            if oi.product.id == prod_id:
                del ctx.deps.current_order["items"][idx]
                break
    ORDER_WINDOW.root.after(0, ORDER_WINDOW.update_order_display, ctx.deps.current_order)
    recap = {
        "items": [
            {"id": oi.product.id, "name": oi.product.name, "price": oi.product.price, "special_instructions": oi.special_instructions}
            for oi in ctx.deps.current_order["items"]
        ]
    }
    return json.dumps(recap, indent=2)

# -----------------------------------------------------------------------------
# Tool: place_order
# -----------------------------------------------------------------------------
@agent.tool
async def place_order(ctx: RunContext[RestaurantDeps]) -> str:
    """
    Finalize the order:
      - Read existing orders from orders.json,
      - Assign an order number (incremented based on existing orders),
      - Append the finalized order (including special instructions) to the file,
      - Clear the in-memory order,
      - Update the GUI to display a THANKS message with the order number,
      - And return the order number.
    """
    orders_file = "orders.json"
    if os.path.exists(orders_file):
        with open(orders_file, "r") as f:
            orders = json.load(f)
    else:
        orders = []
    order_number = len(orders) + 1
    final_order = {
        "order_number": order_number,
        "items": [
            {"id": oi.product.id, "name": oi.product.name, "price": oi.product.price, "special_instructions": oi.special_instructions}
            for oi in ctx.deps.current_order["items"]
        ]
    }
    orders.append(final_order)
    with open(orders_file, "w") as f:
        json.dump(orders, f, indent=2)
    ctx.deps.current_order["items"] = []
    ORDER_WINDOW.root.after(0, ORDER_WINDOW.show_final_message, order_number)
    return f"Final order placed. Your order number is {order_number}."

# -----------------------------------------------------------------------------
# Interactive Loop (runs in a separate thread)
# -----------------------------------------------------------------------------
async def interactive_loop():
    # Define the restaurant menu with ids.
    menu = [
    MenuItem(id=1, name="Margherita Pizza", ingredients=["tomato", "mozzarella", "basil"], price=9.99),
    MenuItem(id=2, name="Spaghetti Bolognese", ingredients=["spaghetti", "beef", "tomato sauce"], price=12.99),
    MenuItem(id=3, name="Caesar Salad", ingredients=["lettuce", "croutons", "parmesan", "caesar dressing"], price=7.99),
    MenuItem(id=4, name="Pepperoni Pizza", ingredients=["tomato", "mozzarella", "pepperoni"], price=11.99),
    MenuItem(id=5, name="Penne Arrabbiata", ingredients=["penne", "garlic", "chili peppers", "tomato sauce"], price=10.99),
    MenuItem(id=6, name="Greek Salad", ingredients=["cucumber", "tomato", "feta", "olives"], price=8.49),
    MenuItem(id=7, name="Chicken Alfredo", ingredients=["fettuccine", "chicken", "alfredo sauce"], price=13.99),
    MenuItem(id=8, name="Mushroom Risotto", ingredients=["rice", "mushrooms", "parmesan", "white wine"], price=14.49),
    MenuItem(id=9, name="Garlic Bread", ingredients=["bread", "garlic", "butter", "parsley"], price=4.49),
    MenuItem(id=10, name="Tiramisu", ingredients=["mascarpone", "espresso", "ladyfingers", "cocoa"], price=6.99)
]
    deps = RestaurantDeps(menu=menu)
    history = []  # Conversation history.
    
    print("Restaurant Assistant is ready. Type your queries below (type 'exit' to quit):")
    while True:
        user_input = await asyncio.to_thread(input, ">> ")
        if user_input.lower() in {"exit", "quit"}:
            break
        result = await agent.run(user_input, deps=deps, message_history=history)
        print("Assistant:", result.data)
        history.extend(result.new_messages())

def start_interactive_loop():
    asyncio.run(interactive_loop())

# -----------------------------------------------------------------------------
# Main: Start interactive loop in a thread and run the Tkinter GUI in main thread.
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    interactive_thread = threading.Thread(target=start_interactive_loop)
    interactive_thread.start()
    # Run the Tkinter GUI (must be in main thread)
    ORDER_WINDOW.start()
