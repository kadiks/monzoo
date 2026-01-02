import { Cookie, CookieJar } from "tough-cookie";
import fs, { writeFileSync } from "fs";

import { calculateStockToAdd } from "./calculateStockToAdd.js";
import chalk from "chalk";
import jsdom from "jsdom";

const { JSDOM } = jsdom;

const baseURL = "https://monzoo.net";

// Global cookie jar to maintain authenticated session
const cookieJar = new CookieJar();

const login = async (username, password) => {
  console.log(chalk.cyan(`\n📋 Step 1: Logging in...`));

  console.log(chalk.dim("  ⏳ Human-like delay before login request..."));
  // await randomDelay();

  const url = `${baseURL}/login.php`;
  console.log(chalk.dim(`  Sending login request to: ${url}`));

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

  console.log(chalk.dim(`  Response status: ${response.status}`));
  console.log(chalk.dim(`  Response URL: ${response.url}`));

  const locationHeader = response.headers.get("location");
  if (locationHeader) {
    console.log(chalk.dim(`  Redirect location: ${locationHeader}`));

    // Check if redirected to error page
    if (locationHeader.includes("index.php?erreur=")) {
      console.log(
        chalk.red(
          "✗ Login failed - invalid credentials or authentication error"
        )
      );
      throw new Error(
        "Login failed: Redirected to error page. Please check your username and password in Preferences."
      );
    }
  }

  const setCookieHeaders = response.headers.getSetCookie();
  if (setCookieHeaders.length > 0) {
    console.log(chalk.dim(`  Cookies received: ${setCookieHeaders.length}`));
    for (const cookieStr of setCookieHeaders) {
      const cookie = Cookie.parse(cookieStr);
      if (cookie) {
        console.log(chalk.dim(`    - ${cookie.key}`));
        await cookieJar.setCookie(cookie, url);
      }
    }
  } else {
    console.log(chalk.yellow("  ⚠ No cookies received from login response"));
  }

  if (response.status >= 200 && response.status < 400) {
    console.log(chalk.green("✓ Login successful"));
  } else {
    console.log(chalk.red(`✗ Login failed with status ${response.status}`));
  }

  // If we have a valid redirect location (not error), follow it
  if (locationHeader && !locationHeader.includes("index.php?erreur=")) {
    console.log(chalk.dim(`  Following redirect to load page...`));
    const redirectUrl = locationHeader.startsWith("http")
      ? locationHeader
      : `${baseURL}/${locationHeader}`;

    const { response } = await fetchAuthenticatedPage(redirectUrl);

    console.log(chalk.dim(`  Redirect page loaded: ${response.status}`));
  }

  return response;
};

const fetchAuthenticatedPage = async (url) => {
  console.log(chalk.dim("  ⏳ Human-like delay before fetching page..."));

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
  const delayMs =
    Math.random() * (maxSeconds - minSeconds) * 1000 + minSeconds * 1000;
  const delaySec = (delayMs / 1000).toFixed(2);
  console.log(chalk.dim(`  ⏳ Waiting ${delaySec}s before next request...`));
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
};

// Save HTML response to fixtures for debugging
const saveHtmlFixture = (html, filename) => {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const fixturesDir = "./fixtures";
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }
  const fixturesPath = `${fixturesDir}/${filename}-${timestamp}.html`;
  writeFileSync(fixturesPath, html);
  console.log(chalk.dim(`  Saved response to ${fixturesPath}`));
};

// Load HTML from fixtures for debugging
const loadHtmlFixture = (filename) => {
  const fixturesPath = `./fixtures/${filename}`;
  const html = fs.readFileSync(fixturesPath, "utf-8");
  console.log(chalk.dim(`  Loaded fixture from ${fixturesPath}`));
  return html;
};

// Extract routes in need from HTML
export const extractRoutesInNeed = (html) => {
  const document = getDocumentFromHTML(html);

  const routesInNeed = [
    ...document.querySelectorAll(
      'select#jumpMenu option[style="color:#FF0000"]'
    ),
  ].map((el) => el.value.replace(baseURL, ""));

  return routesInNeed;
};

const getAllEnclosureInNeed = async () => {
  console.log(
    chalk.cyan(`\n🏢 Step 2: Checking enclosures in need of care...`)
  );

  const { html, response } = await fetchAuthenticatedPage(
    `${baseURL}/enclosgestion1.php?t=0&v=0`
  );
  if (response.status !== 200) {
    console.log(chalk.red("✗ Page to get all enclosure is not accessible"));
    throw new Error("Page to get all enclosure is not accessible");
  }

  // Save HTML to fixtures for debugging
  saveHtmlFixture(html, "enclosgestion1");

  // const html = loadHtmlFixture('enclosgestion1-2025-12-31T15-41-23.html');

  const routesInNeed = extractRoutesInNeed(html);

  console.log(
    chalk.yellow(`Found ${routesInNeed.length} enclosure(s) in need`)
  );

  for (let i = 0; i < routesInNeed.length; i++) {
    const routeInNeed = routesInNeed[i];
    await randomDelay();
    console.log(
      chalk.dim(`  Checking enclosure ${i + 1}/${routesInNeed.length}...`)
    );
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
  const { html, response } = await fetchAuthenticatedPage(
    `${baseURL}/bureau4.php`
  );
  if (response.status !== 200) {
    throw new Error("Page to get stocks is not accessible");
  }

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

  return [animalStocks, giftsStocks, friesStocks, drinksStocks, iceCreamStocks];
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
  console.log(
    chalk.dim(`  ⏳ Human-like delay before adding ${stockEntry.type} stock...`)
  );
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
    throw new Error(
      `Failed to add ${stockEntry.type} stock: HTTP ${response.status}`
    );
  }

  console.log(
    chalk.green(`  ✓ Added ${amountToAdd} units of ${stockEntry.type}`)
  );
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
 * @param {string} username - MonZoo username from preferences
 * @param {string} password - MonZoo password from Keychain
 */
export const runMonzooCycle = async (username, password) => {
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

    console.log(
      chalk.cyan(
        `\n📝 Step 4: Checking stock levels and adding if necessary...`
      )
    );
    for (const stockEntry of stocks) {
      const amountToAdd = calculateStockToAdd(stockEntry);
      const minSafe = stockEntry.dailyConsumption * 3;

      if (amountToAdd > 0) {
        console.log(
          chalk.yellow(
            `  ${stockEntry.type}: needs ${amountToAdd} units (${stockEntry.stocks} >= ${minSafe})`
          )
        );
        await addStock(stockEntry, amountToAdd);
        summary.itemsAdded.push({ type: stockEntry.type, amount: amountToAdd });
      } else {
        console.log(
          chalk.cyan(
            `  ✓ ${stockEntry.type}: stock is safe (${stockEntry.stocks} >= ${minSafe})`
          )
        );
        summary.itemsSafe.push({
          type: stockEntry.type,
          stocks: stockEntry.stocks,
          minSafe,
        });
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
