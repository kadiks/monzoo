const jsdom = require("jsdom");
const { Cookie, CookieJar } = require("tough-cookie");
const { JSDOM } = jsdom;

const username = process.env.MONZOO_USERNAME;
const password = process.env.MONZOO_PASSWORD;

const baseURL = "https://monzoo.net";

const animalPages = [
  "/animaux.php?choix_type=savane",
  "/animaux.php?choix_type=noctarium",
  "/animaux.php?choix_type=foret",
  "/animaux.php?choix_type=bassin",
  "/animaux.php?choix_type=terre",
  "/animaux.php?choix_type=voliere",
  "/animaux.php?choix_type=vivarium",
  "/animaux.php?choix_type=aquarium",
  "/animaux.php?choix_type=insectarium",
  "/animaux.php?choix_type=ile%20aux%20dinos",
];

// Create a global cookie jar to persist session
const cookieJar = new CookieJar();

const login = async (username, password) => {
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
    redirect: "manual", // Don't follow redirects automatically
  });

  // Store all cookies from response
  const setCookieHeaders = response.headers.getSetCookie(); // Use getSetCookie() for multiple cookies
  console.log("Login cookies:", setCookieHeaders);

  for (const cookieStr of setCookieHeaders) {
    const cookie = Cookie.parse(cookieStr);
    if (cookie) {
      await cookieJar.setCookie(cookie, url);
    }
  }

  // Check all stored cookies
  const allCookies = await cookieJar.getCookies(url);
  console.log(
    "Stored cookies:",
    allCookies.map((c) => `${c.key}=${c.value}`)
  );

  return response;
};

const fetchAuthenticatedPage = async (url) => {
  // Get all cookies for this URL
  const cookies = await cookieJar.getCookieString(url);
  console.log("Sending cookies:", cookies);

  const response = await fetch(url, {
    headers: {
      Cookie: cookies,
    },
  });

  // Store any new cookies from this response
  const setCookieHeaders = response.headers.getSetCookie();
  for (const cookieStr of setCookieHeaders) {
    const cookie = Cookie.parse(cookieStr);
    if (cookie) {
      await cookieJar.setCookie(cookie, url);
    }
  }

  const html = await response.text();
  console.log("Response URL:", response.url);
  return { html, response };
};

const getDocumentFromHTML = (html) => {
  const dom = new JSDOM(html);
  return dom.window.document;
};

const timer = () => {
  return new Promise((resolve) => {
    setTimeout(resolve, 3_000);
  });
};

const getAllEnclosureInNeed = async () => {
  const { html, response } = await fetchAuthenticatedPage(
    `${baseURL}/enclosgestion1.php?t=0&v=0`
  );
  if (response.status !== 200) {
    const message = "Page to get all enclosure is not accessible";
    console.log(message);
    throw message;
  }
  const document = getDocumentFromHTML(html);

  const routesInNeed = [
    ...document.querySelectorAll(
      'select#jumpMenu option[style="color:#FF0000"]'
    ),
  ].map((el) => el.value.replace(baseURL, ""));
  console.log("optionsInNeed", routesInNeed);

  //   for (optionsInNeed)
  for (const routeInNeed of routesInNeed) {
    await timer();
    await fetchAuthenticatedPage(`${baseURL}${routeInNeed}&bot=1& #less`);
  }
};

// food
// // POST - bureau4.php
// // Form data { add_stock: <num>, button: 'Envoyer' }
// porte clés
// // POST - bureau4.php
// // Form data { nb_stock: <num>, type_stock: 1, button2: 'Acheter' }
// frites
// // POST - bureau4.php
// // Form data { nb_stock: <num>, type_stock: 2, button3: 'Acheter' }
// boissons
// // POST - bureau4.php
// // Form data { nb_stock: <num>, type_stock: 3, button4: 'Acheter' }
// glaces
// // POST - bureau4.php
// // Form data { nb_stock: <num>, type_stock: 4, button5: 'Acheter' }

// any items rules
// quand on a plus du double de la consommation journalière, mais moins du triple, on rachète exactement la consommation

const getFoodStocks = async () => {
  const { html, response } = await fetchAuthenticatedPage(
    `${baseURL}/bureau4.php`
  );
  if (response.status !== 200) {
    const message = "Page to get food stocks is not accessible";
    console.log(message);
    throw message;
  }
  const document = getDocumentFromHTML(html);

  const animalFoodForm = document.querySelector('form[action="bureau4.php"]');
  const animalFoodStocks = animalFoodForm.querySelector("strong").textContent;
  const animalFoodNeed = animalFoodForm
    .closest("table")
    .querySelector("tr:nth-child(2)")
    .querySelector(
      "td > table > tbody > tr > td:nth-child(2) strong"
    ).textContent;

  console.log({
    animalFoodStocks,
    animalFoodNeed,
  });
};

login(username, password)
  .then(async (response) => {
    console.log("Login response:", response.status);
    console.log("Login redirect location:", response.headers.get("location"));

    // // Now make authenticated requests
    // const { html, response: pageResponse } = await fetchAuthenticatedPage(
    //   `${baseURL}/zonemembre.php?gomaj`
    // );
    // console.log("Page response:", pageResponse.status);
    // // console.log("First 500 chars:", html.substring(0, 500));
    // const dom = new JSDOM(html)
    // console.log('Pourcentage', dom.window.document.querySelector('a[href="https://monzoo.net/regle.php#bareme"]').textContent)
    // await getAllEnclosureInNeed();
    await getFoodStocks();
  })
  .catch(console.error);
