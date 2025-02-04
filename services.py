import os
import json
import uuid
from typing import List, Dict
from models import MenuItem, OrderItem, RestaurantDeps
from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIModel

class ChatService:
    def __init__(self, websocket_manager):
        self.sessions: Dict[str, RestaurantDeps] = {}
        self.message_history: Dict[str, List] = {}
        self.websocket_manager = websocket_manager
        self.menu = self._load_menu()
        self.agent = self._initialize_agent()

    def _load_menu(self) -> List[MenuItem]:
        """Load the restaurant menu."""
        return [
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

    async def _send_order_update(self, session_id: str):
        """Send order update through WebSocket."""
        order = self.get_order(session_id)
        await self.websocket_manager.send_order_update(session_id, order)

    async def _send_past_order(self, session_id: str, order_number: int):
        """
        Send a WebSocket message of type 'past_order' containing the order number
        when the user says their order is finished.
        """
        data = {
            "type": "past_order",
            "order_number": order_number
        }
        await self.websocket_manager.send_json(session_id, data)

    def _merge_or_add_order_item(self, current_items: List[OrderItem], new_item: OrderItem) -> None:
        """
        Merge the new item with existing items if they have the same product and instructions,
        otherwise add it as a new item.
        """
        # Try to find matching item (same product and instructions)
        matching_item = next(
            (item for item in current_items
             if item.product.id == new_item.product.id and
             item.special_instructions == new_item.special_instructions),
            None
        )

        if matching_item:
            # If found matching item, increment its quantity
            matching_item.quantity += new_item.quantity
        else:
            # If no matching item found, add new item
            current_items.append(new_item)

    def _initialize_agent(self):
        """Initialize the AI agent."""
        model = OpenAIModel("gpt-4o-mini", api_key=os.getenv("OPENAI_API_KEY"))
        agent = Agent(model)

        @agent.system_prompt
        async def dynamic_prompt(ctx: RunContext[RestaurantDeps]) -> str:
            menu_lines = [
                f"{item.id} - {item.name}: {', '.join(item.ingredients)} - ${item.price:.2f}"
                for item in ctx.deps.menu
            ]
            menu_details = "\n".join(menu_lines)
            return (
                f"You are a restaurant assistant for mc drive AI. Here is our menu:\n{menu_details}\n\n"
                "generate the shortest possible response to the user's message."
                "Answer questions about our menu accurately. "
                "When a customer wants to order, use 'update_order' to add items. You can specify quantity and special instructions. "
                "For example, if someone wants 2 pizzas but one without cheese, make two separate orders: "
                "one with quantity 1 and 'no cheese' instruction, and another with quantity 1 and normal instructions. "
                "if customer dosnt indicate quantity, assume 1. "
                "If a customer wants to remove an item, use 'remove_order_item'. "
                "Always ask if they want something else, and only when the customer says they are done, call 'place_order'."
               
            )

        @agent.tool
        async def update_order(ctx: RunContext[RestaurantDeps],
                               order_item_ids: List[int],
                               quantity: int = 1,
                               special_instructions: str = "") -> str:
            """Update the user's order."""
            for prod_id in order_item_ids:
                product = next((p for p in ctx.deps.menu if p.id == prod_id), None)
                if product:
                    instructions = special_instructions if special_instructions.strip() else "none"
                    new_item = OrderItem(
                        product=product,
                        special_instructions=instructions,
                        quantity=quantity
                    )
                    self._merge_or_add_order_item(ctx.deps.current_order["items"], new_item)

            await self._send_order_update(ctx.deps.session_id)

            return json.dumps(self.get_order(ctx.deps.session_id), indent=2)

        @agent.tool
        async def remove_order_item(ctx: RunContext[RestaurantDeps],
                                    order_item_ids: List[int],
                                    quantity: int = None) -> str:
            """Remove items from the order."""
            for prod_id in order_item_ids:
                # Find all items matching this product id
                matching_items = [
                    (idx, item) for idx, item in enumerate(ctx.deps.current_order["items"])
                    if item.product.id == prod_id
                ]

                if matching_items:
                    if quantity is None:
                        # Remove all quantities of this item
                        for idx, _ in reversed(matching_items):
                            del ctx.deps.current_order["items"][idx]
                    else:
                        # Remove specific quantity
                        idx, item = matching_items[0]  # Take first matching item
                        if item.quantity <= quantity:
                            del ctx.deps.current_order["items"][idx]
                        else:
                            item.quantity -= quantity

            await self._send_order_update(ctx.deps.session_id)
            return json.dumps(self.get_order(ctx.deps.session_id), indent=2)

        @agent.tool
        async def place_order(ctx: RunContext[RestaurantDeps]) -> str:
            """Finalize the order."""
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
                    {
                        "id": oi.product.id,
                        "name": oi.product.name,
                        "price": oi.product.price,
                        "quantity": oi.quantity,
                        "special_instructions": oi.special_instructions,
                        "total_price": oi.product.price * oi.quantity
                    }
                    for oi in ctx.deps.current_order["items"]
                ]
            }
            final_order["total"] = sum(item["total_price"] for item in final_order["items"])

            orders.append(final_order)
            with open(orders_file, "w") as f:
                json.dump(orders, f, indent=2)

            # Clear the in-memory order
            ctx.deps.current_order["items"] = []

            # Send normal "order update" that effectively empties the cart
            # await self._send_order_update(ctx.deps.session_id)

            # NEW STEP: Inform the client via WebSocket that the order is finished.
            await self._send_past_order(ctx.deps.session_id, order_number)

            return json.dumps({
                "status": "completed",
                "order_number": order_number,
                "message": f"Final order placed. Your order number is {order_number}."
            })

        return agent

    def start_session(self) -> str:
        """Start a new session."""
        session_id = str(uuid.uuid4())
        self.sessions[session_id] = RestaurantDeps(
            menu=self.menu,
            current_order={"items": []},
            session_id=session_id
        )
        self.message_history[session_id] = []
        return session_id

    async def process_message(self, session_id: str, message: str) -> str:
        """Process the user's message."""
        if session_id not in self.sessions:
            raise ValueError("Session not found")

        context = self.sessions[session_id]
        history = self.message_history.get(session_id, [])

        result = await self.agent.run(message, deps=context, message_history=history)
        self.message_history[session_id].extend(result.new_messages())

        return result.data

    def get_order(self, session_id: str):
        """Retrieve the current order."""
        context = self.sessions[session_id]
        order_items = [
            {
                "id": item.product.id,
                "name": item.product.name,
                "price": item.product.price,
                "quantity": item.quantity,
                "special_instructions": item.special_instructions,
                "total_price": item.product.price * item.quantity
            }
            for item in context.current_order["items"]
        ]
        total = sum(item["total_price"] for item in order_items)

        return {
            "items": order_items,
            "total": total
        }

    def end_session(self, session_id: str):
        """End the session and clear memory."""
        if session_id in self.sessions:
            del self.sessions[session_id]
        if session_id in self.message_history:
            del self.message_history[session_id]
