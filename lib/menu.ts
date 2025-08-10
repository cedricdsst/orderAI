import type { MenuSection, MenuItem } from "./types";

export const MENU_FR: MenuSection[] = [
  {
    id: "burgers",
    name: "Burgers",
    items: [
      { id: "burger_classic", name: "Burger Classique", priceCents: 500 },
      { id: "burger_cheese", name: "Burger au Fromage", priceCents: 550 },
      { id: "burger_double", name: "Double Burger", priceCents: 750 },
    ],
  },
  {
    id: "sides",
    name: "Accompagnements",
    items: [
      { id: "fries_small", name: "Frites (Petites)", priceCents: 200 },
      { id: "fries_large", name: "Frites (Grandes)", priceCents: 300 },
      { id: "nuggets_6", name: "Nuggets (6)", priceCents: 450 },
    ],
  },
  {
    id: "drinks",
    name: "Boissons",
    items: [
      { id: "coke_small", name: "Coca-Cola (25cl)", priceCents: 200 },
      { id: "coke_large", name: "Coca-Cola (50cl)", priceCents: 300 },
      { id: "water", name: "Eau", priceCents: 150 },
    ],
  },
  {
    id: "desserts",
    name: "Desserts",
    items: [
      { id: "mcflurry_oreo", name: "Glace Oreo", priceCents: 450 },
      { id: "apple_pie", name: "Chausson aux pommes", priceCents: 250 },
    ],
  },
];

export const MENU_EN: MenuSection[] = [
  {
    id: "burgers",
    name: "Burgers",
    items: [
      { id: "burger_classic", name: "Classic Burger", priceCents: 500 },
      { id: "burger_cheese", name: "Cheese Burger", priceCents: 550 },
      { id: "burger_double", name: "Double Burger", priceCents: 750 },
    ],
  },
  {
    id: "sides",
    name: "Sides",
    items: [
      { id: "fries_small", name: "Small Fries", priceCents: 200 },
      { id: "fries_large", name: "Large Fries", priceCents: 300 },
      { id: "nuggets_6", name: "Nuggets (6)", priceCents: 450 },
    ],
  },
  {
    id: "drinks",
    name: "Drinks",
    items: [
      { id: "coke_small", name: "Coca-Cola (25cl)", priceCents: 200 },
      { id: "coke_large", name: "Coca-Cola (50cl)", priceCents: 300 },
      { id: "water", name: "Water", priceCents: 150 },
    ],
  },
  {
    id: "desserts",
    name: "Desserts",
    items: [
      { id: "mcflurry_oreo", name: "Oreo Ice Cream", priceCents: 450 },
      { id: "apple_pie", name: "Apple Pie", priceCents: 250 },
    ],
  },
];

export function getMenu(locale: string): MenuSection[] {
  return locale === "en" ? MENU_EN : MENU_FR;
}

export function getAllMenuItems(locale: string): MenuItem[] {
  return getMenu(locale).flatMap((s) => s.items);
}

export function getAllowedItemNames(locale: string): string[] {
  return getAllMenuItems(locale).map((it) => it.name);
}

export function findMenuItemById(id: string, locale: string): MenuItem | undefined {
  return getAllMenuItems(locale).find((it) => it.id === id);
}

// Keep backward compatibility
export const MENU = MENU_FR;
export const ALL_MENU_ITEMS = MENU_FR.flatMap((s) => s.items);
export const ALLOWED_ITEM_IDS = ALL_MENU_ITEMS.map((it) => it.id);
export const ALLOWED_ITEM_NAMES = ALL_MENU_ITEMS.map((it) => it.name);


