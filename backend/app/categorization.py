from collections.abc import Iterable


CATEGORY_TERMS: dict[str, tuple[str, ...]] = {
    "Career Development": (
        "linkedin",
        "coursera",
        "udemy",
        "conference",
        "openai",
        "bookstore",
    ),
    "Health & Fitness": ("gym", "fitness", "classpass", "pharmacy", "yoga"),
    "Social Life": ("restaurant", "bar", "coffee", "cafe", "cinema", "ticket"),
    "Travel": ("airline", "hotel", "airbnb", "flight", "amtrak"),
    "Convenience": ("uber", "lyft", "doordash", "delivery", "instacart"),
    "Subscriptions": ("spotify", "netflix", "icloud", "adobe", "subscription"),
    "Housing": ("rent", "mortgage", "apartment"),
    "Groceries": ("trader joe", "whole foods", "safeway", "grocery", "costco"),
    "Shopping": ("amazon", "zara", "uniqlo", "target", "store"),
    "Transportation": ("gas", "shell", "chevron", "parking", "transit", "bart"),
    "Utilities": ("utility", "internet", "phone", "electric", "water"),
    "Income": ("payroll", "salary", "direct deposit"),
}


def categorize(merchant: str, description: str = "") -> str:
    text = f"{merchant} {description}".lower()
    for category, terms in CATEGORY_TERMS.items():
        if any(term in text for term in terms):
            return category
    return "Other"


def category_vocabulary() -> Iterable[str]:
    return CATEGORY_TERMS.keys()
