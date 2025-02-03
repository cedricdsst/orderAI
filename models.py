# models.py
from dataclasses import dataclass, field
from typing import List, Dict

@dataclass
class MenuItem:
    id: int
    name: str
    ingredients: List[str]
    price: float

@dataclass
class OrderItem:
    product: MenuItem
    special_instructions: str = "none"
    quantity: int = 1  # Added quantity field with default value of 1

@dataclass
class RestaurantDeps:
    menu: List[MenuItem]
    current_order: dict = field(default_factory=lambda: {"items": []})
    session_id: str = ""