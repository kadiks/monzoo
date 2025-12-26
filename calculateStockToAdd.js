const calculateStockToAdd = (stockEntry) => {
  const { stocks, dailyConsumption } = stockEntry;

  // Validate inputs
  if (stocks < 0 || dailyConsumption < 0) {
    throw new Error("stocks and dailyConsumption cannot be negative");
  }

  const minSafeStock = dailyConsumption * 3;

  // If current stock is already at or above 3x daily consumption, no need to add
  if (stocks >= minSafeStock) {
    return 0;
  }

  // Otherwise, add enough to reach 4x daily consumption
  const targetStock = dailyConsumption * 4;
  return targetStock - stocks;
};

export { calculateStockToAdd };