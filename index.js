import { Cookie, CookieJar } from "tough-cookie";

import { calculateStockToAdd } from "./calculateStockToAdd.js";
import chalk from "chalk";
import fs from "fs";
import jsdom from "jsdom";

const { JSDOM } = jsdom;

const username = process.env.MONZOO_USERNAME;
const password = process.env.MONZOO_PASSWORD;

const baseURL = "https://monzoo.net";

// Global cookie jar to maintain authenticated session
const cookieJar = new CookieJar();

const login = async (username, password) => {
  console.log(chalk.cyan(`\n📋 Step 1: Logging in...`));
  
  console.log(chalk.dim("  ⏳ Human-like delay before login request..."));
  await randomDelay();
  
  const url = `${baseURL}/login.php`;

  const formData = new URLSearchParams();
  formData.append("pseudo", username);
  formData.append("passe", password);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData,
    redirect: "manual",
  });

  const setCookieHeaders = response.headers.getSetCookie();
  for (const cookieStr of setCookieHeaders) {
    const cookie = Cookie.parse(cookieStr);
    if (cookie) {
      await cookieJar.setCookie(cookie, url);
    }
  }

  console.log(chalk.green("✓ Login successful"));
  return response;
};

const fetchAuthenticatedPage = async (url) => {
  console.log(chalk.dim("  ⏳ Human-like delay before fetching page..."));
  await randomDelay();
  
  const cookies = await cookieJar.getCookieString(url);

  const response = await fetch(url, {
    headers: {
      Cookie: cookies,
    },
  });

  const setCookieHeaders = response.headers.getSetCookie();
  for (const cookieStr of setCookieHeaders) {
    const cookie = Cookie.parse(cookieStr);
    if (cookie) {
      await cookieJar.setCookie(cookie, url);
    }
  }

  const html = await response.text();
  return { html, response };
};

const getDocumentFromHTML = (html) => {
  const dom = new JSDOM(html);
  return dom.window.document;
};

// Generate a random delay between min and max seconds
const randomDelay = (minSeconds = 5, maxSeconds = 12) => {
  const delayMs = Math.random() * (maxSeconds - minSeconds) * 1000 + minSeconds * 1000;
  const delaySec = (delayMs / 1000).toFixed(2);
  console.log(chalk.dim(`  ⏳ Waiting ${delaySec}s before next request...`));
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
};

const getAllEnclosureInNeed = async () => {
  console.log(chalk.cyan(`\n🏢 Step 2: Checking enclosures in need of care...`));
  
  const { html, response } = await fetchAuthenticatedPage(
    `${baseURL}/enclosgestion1.php?t=0&v=0`
  );
  if (response.status !== 200) {
    console.log(chalk.red("✗ Page to get all enclosure is not accessible"));
    throw new Error("Page to get all enclosure is not accessible");
  }
  
  const document = getDocumentFromHTML(html);

  const routesInNeed = [
    ...document.querySelectorAll(
      'select#jumpMenu option[style="color:#FF0000"]'
    ),
  ].map((el) => el.value.replace(baseURL, ""));
  
  console.log(chalk.yellow(`Found ${routesInNeed.length} enclosure(s) in need`));

  for (const routeInNeed of routesInNeed) {
    await randomDelay();
    await fetchAuthenticatedPage(`${baseURL}${routeInNeed}&bot=1& #less`);
  }
  
  console.log(chalk.green("✓ Enclosures checked"));
};

// Stock type configuration for boutique items
const boutiqueStockType = {
  gifts: {
    tableColumnIndex: 0,
    name: "gifts",
  },
  fries: {
    tableColumnIndex: 1,
    name: "fries",
  },
  drinks: {
    tableColumnIndex: 2,
    name: "drinks",
  },
  iceCreams: {
    tableColumnIndex: 3,
    name: "iceCreams",
  },
};

const getStocks = async () => {
  const html = fs.readFileSync("./fixtures/bureau4.html", "utf-8");
  const document = getDocumentFromHTML(html);

  const animalStocks = getAnimalFoodStocks(document);
  const [giftsStocks, friesStocks, drinksStocks, iceCreamStocks] = [
    getBoutiqueStocks(
      document,
      boutiqueStockType.gifts.tableColumnIndex,
      boutiqueStockType.gifts.name
    ),
    getBoutiqueStocks(
      document,
      boutiqueStockType.fries.tableColumnIndex,
      boutiqueStockType.fries.name
    ),
    getBoutiqueStocks(
      document,
      boutiqueStockType.drinks.tableColumnIndex,
      boutiqueStockType.drinks.name
    ),
    getBoutiqueStocks(
      document,
      boutiqueStockType.iceCreams.tableColumnIndex,
      boutiqueStockType.iceCreams.name
    ),
  ];

  return [
    animalStocks,
    giftsStocks,
    friesStocks,
    drinksStocks,
    iceCreamStocks,
  ];
};

const getAnimalFoodStocks = (document) => {
  const animalFoodForm = document.querySelector('form[action="bureau4.php"]');
  const animalFoodStocks = animalFoodForm.querySelector("strong").textContent;
  const animalFoodNeed = animalFoodForm
    .closest("table")
    .querySelector("tr:nth-child(2)")
    .querySelector(
      "td > table > tbody > tr > td:nth-child(2) strong"
    ).textContent;

  return {
    type: "food",
    stocks: Number(animalFoodStocks),
    dailyConsumption: Math.abs(Number(animalFoodNeed)),
  };
};

const getBoutiqueStocks = (document, tableColumnIndex, elementType) => {
  const el = document.querySelectorAll('form[action=""]')[tableColumnIndex];
  const stocks = el.querySelector("div strong").textContent;
  const dailyConsumption = el
    .closest("tr")
    .nextElementSibling.querySelectorAll("td")
    [tableColumnIndex].querySelector("div")
    .textContent.trim()
    .replace(" Stocks / Maj", "");
  return {
    type: elementType,
    stocks: Number(stocks),
    dailyConsumption: Math.abs(Number(dailyConsumption)),
  };
};

const addStock = async (stockEntry, amountToAdd) => {
  console.log(chalk.dim(`  ⏳ Human-like delay before adding ${stockEntry.type} stock...`));
  await randomDelay();
  
  const url = `${baseURL}/bureau4.php`;
  const cookies = await cookieJar.getCookieString(url);

  const formData = new URLSearchParams();

  switch (stockEntry.type) {
    case "food":
      formData.append("add_stock", amountToAdd);
      formData.append("button", "Envoyer");
      break;

    case "gifts":
      formData.append("nb_stock", amountToAdd);
      formData.append("type_stock", 1);
      formData.append("button2", "Acheter");
      break;

    case "fries":
      formData.append("nb_stock", amountToAdd);
      formData.append("type_stock", 2);
      formData.append("button3", "Acheter");
      break;

    case "drinks":
      formData.append("nb_stock", amountToAdd);
      formData.append("type_stock", 3);
      formData.append("button4", "Acheter");
      break;

    case "iceCreams":
      formData.append("nb_stock", amountToAdd);
      formData.append("type_stock", 4);
      formData.append("button5", "Acheter");
      break;

    default:
      throw new Error(`Unknown stock type: ${stockEntry.type}`);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies,
    },
    body: formData,
  });

  if (response.status !== 200) {
    throw new Error(`Failed to add ${stockEntry.type} stock: HTTP ${response.status}`);
  }

  console.log(chalk.green(`  ✓ Added ${amountToAdd} units of ${stockEntry.type}`));
  return response;
};

/**
 * Main orchestration function
 * Workflow:
 * 1. Login to the platform
 * 2. Check enclosures that need care
 * 3. Get current stock levels
 * 4. Calculate and add stock if needed
 *
 * Returns a summary object of actions performed for UI/logging.
 */
export const runMonzooCycle = async () => {
  const startedAt = new Date().toISOString();
  const summary = {
    startedAt,
    finishedAt: null,
    itemsAdded: [], // { type, amount }
    itemsSafe: [], // { type, stocks, minSafe }
    errors: [],
    ok: true,
  };

  try {
    await login(username, password);
    await getAllEnclosureInNeed();

    console.log(chalk.cyan(`\n📦 Step 3: Fetching current stocks...`));
    const stocks = await getStocks();
    console.log(chalk.green("✓ Stocks fetched"));

    console.log(chalk.cyan(`\n📝 Step 4: Checking stock levels and adding if necessary...`));
    for (const stockEntry of stocks) {
      const amountToAdd = calculateStockToAdd(stockEntry);

      if (amountToAdd > 0) {
        console.log(chalk.yellow(`  ${stockEntry.type}: needs ${amountToAdd} units`));
        await addStock(stockEntry, amountToAdd);
        summary.itemsAdded.push({ type: stockEntry.type, amount: amountToAdd });
      } else {
        const minSafe = stockEntry.dailyConsumption * 3;
        console.log(
          chalk.cyan(`  ✓ ${stockEntry.type}: stock is safe (${stockEntry.stocks} >= ${minSafe})`)
        );
        summary.itemsSafe.push({ type: stockEntry.type, stocks: stockEntry.stocks, minSafe });
      }
    }

    console.log(chalk.green(`\n✅ All done!\n`));
    summary.finishedAt = new Date().toISOString();
    return summary;
  } catch (error) {
    summary.ok = false;
    summary.errors.push(error.message || String(error));
    summary.finishedAt = new Date().toISOString();
    console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    return summary;
  }
};
