/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearSelectedProducts = document.getElementById("clearSelectedProducts");
const productDetailsDialog = document.getElementById("productDetailsDialog");
const productDetailsContent = document.getElementById("productDetailsContent");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const chatInput = document.getElementById("userInput");
const generateRoutine = document.getElementById("generateRoutine");
const chatSubmitButton = document.getElementById("sendBtn");

/* Keep the product data and selected products available across categories */
let allProducts = [];
const selectedProducts = new Map();
const selectedProductsStorageKey = "loreal-routine-builder-selected-products";
const selectedCategoryStorageKey = "loreal-routine-builder-selected-category";
const workerUrl = "https://late-paper-1967.naomichristian19.workers.dev/";
const systemMessage = {
  role: "system",
  content: `You are a friendly L'Oréal beauty and personal-care advisor.
Use the full conversation history to answer follow-up questions consistently
with the routine you generated. Stay focused on that routine and related
topics such as skincare, haircare, makeup, fragrance, grooming, suncare, and
beauty products.

When first creating a routine, use only the products in the selected-product
data. In follow-up answers, you may discuss related products or topics, but do
not claim that an unselected product was part of the user's routine. If asked
about unrelated topics, politely guide the conversation back to beauty and
personal care.

Do not diagnose medical conditions. Suggest a healthcare professional for
medical concerns and remind users to follow product directions.`,
};
let messages = [systemMessage];
let routineHasBeenGenerated = false;

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  if (!response.ok) {
    throw new Error(`Could not load products (${response.status}).`);
  }

  const data = await response.json();
  return data.products;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = selectedProducts.has(product.id);

      return `
        <article class="product-card ${isSelected ? "selected" : ""}">
          <button
            class="product-card-select"
            type="button"
            aria-pressed="${isSelected}"
            data-product-id="${product.id}"
          >
            <img src="${product.image}" alt="${product.name}">
            <div class="product-info">
              <h3>${product.name}</h3>
              <p>${product.brand}</p>
            </div>
          </button>
          <button
            class="view-product-details"
            type="button"
            data-product-id="${product.id}"
          >
            View details
          </button>
        </article>
      `;
    })
    .join("");
}

/* Show selected products with a button to remove each one */
function displaySelectedProducts() {
  clearSelectedProducts.disabled = selectedProducts.size === 0;

  if (selectedProducts.size === 0) {
    selectedProductsList.innerHTML = `
      <p class="empty-selection">No products selected yet.</p>
    `;
    return;
  }

  selectedProductsList.innerHTML = Array.from(selectedProducts.values())
    .map(
      (product) => `
      <div class="selected-product">
        <span>${product.name}</span>
        <button
          class="remove-product"
          type="button"
          data-product-id="${product.id}"
          aria-label="Remove ${product.name}"
        >&times;</button>
      </div>
    `
    )
    .join("");
}

/* Load products and restore saved selections when the page starts */
let productsLoaded = false;

async function initializeProducts() {
  try {
    allProducts = await loadProducts();
    productsLoaded = true;
  } catch (error) {
    console.error("Could not load products:", error);
    displayChatMessage("Assistant", "Products could not be loaded. Please reload the page.");
    return;
  }

  try {
    const savedProductIds = JSON.parse(
      localStorage.getItem(selectedProductsStorageKey) || "[]"
    );

    if (
      !Array.isArray(savedProductIds) ||
      !savedProductIds.every((productId) => Number.isInteger(productId))
    ) {
      throw new Error("Saved product selections are not a valid list of IDs.");
    }

    savedProductIds.forEach((productId) => {
      const product = allProducts.find((item) => item.id === productId);
      if (product) {
        selectedProducts.set(product.id, product);
      }
    });
  } catch (error) {
    console.error("Could not restore saved product selections:", error);
    displayChatMessage(
      "Assistant",
      "Saved product selections could not be restored."
    );
  }

  try {
    const savedCategory = localStorage.getItem(selectedCategoryStorageKey);
    const categoryExists = Array.from(categoryFilter.options).some(
      (option) => option.value === savedCategory && option.value !== ""
    );

    if (categoryExists) {
      categoryFilter.value = savedCategory;
      const filteredProducts = allProducts.filter(
        (product) => product.category === savedCategory
      );
      displayProducts(filteredProducts);
    }
  } catch (error) {
    console.error("Could not restore the last selected category:", error);
    displayChatMessage("Assistant", "The last category could not be restored.");
  }

  displaySelectedProducts();
}

const productsReady = initializeProducts();

/* Save selected product IDs so the selection can be restored after a reload */
function saveSelectedProducts() {
  try {
    const productIds = Array.from(selectedProducts.keys());
    localStorage.setItem(selectedProductsStorageKey, JSON.stringify(productIds));
  } catch (error) {
    console.error("Could not save selected products:", error);
    displayChatMessage(
      "Assistant",
      "Your selections could not be saved in this browser."
    );
  }
}

/* Remember the category so its selected cards are visible after a reload */
function saveSelectedCategory(category) {
  try {
    localStorage.setItem(selectedCategoryStorageKey, category);
  } catch (error) {
    console.error("Could not save the selected category:", error);
    displayChatMessage("Assistant", "The selected category could not be saved.");
  }
}

/* Show all product information in a dialog */
function showProductDetails(productId) {
  const product = allProducts.find((item) => item.id === Number(productId));

  if (!product) {
    console.error(`Could not find product with ID ${productId}.`);
    return;
  }

  productDetailsContent.innerHTML = `
    <img src="${product.image}" alt="${product.name}">
    <h2 id="productDetailsTitle">${product.name}</h2>
    <p class="product-details-brand">${product.brand}</p>
    <p class="product-details-description">${product.description}</p>
  `;
  productDetailsDialog.showModal();
}

/* Add or remove a product and keep its visible card in sync */
function toggleProductSelection(productId) {
  const product = allProducts.find((item) => item.id === Number(productId));

  if (!product) {
    console.error(`Could not find product with ID ${productId}.`);
    return;
  }

  if (selectedProducts.has(product.id)) {
    selectedProducts.delete(product.id);
  } else {
    selectedProducts.set(product.id, product);
  }

  saveSelectedProducts();

  const productSelectButton = productsContainer.querySelector(
    `.product-card-select[data-product-id="${product.id}"]`
  );

  if (productSelectButton) {
    const isSelected = selectedProducts.has(product.id);
    productSelectButton
      .closest(".product-card")
      .classList.toggle("selected", isSelected);
    productSelectButton.setAttribute("aria-pressed", String(isSelected));
  }

  displaySelectedProducts();
}

/* Open details or select a product from its card */
productsContainer.addEventListener("click", (e) => {
  const detailsButton = e.target.closest(".view-product-details");
  if (detailsButton) {
    showProductDetails(detailsButton.dataset.productId);
    return;
  }

  const selectButton = e.target.closest(".product-card-select");
  if (selectButton) {
    toggleProductSelection(selectButton.dataset.productId);
  }
});

/* Close the product details dialog */
document.getElementById("closeProductDetails").addEventListener("click", () => {
  productDetailsDialog.close();
});

/* Remove a product when its X button is clicked */
selectedProductsList.addEventListener("click", (e) => {
  const removeButton = e.target.closest(".remove-product");
  if (removeButton) {
    toggleProductSelection(removeButton.dataset.productId);
  }
});

/* Clear every selected product and reset the visible cards */
clearSelectedProducts.addEventListener("click", () => {
  selectedProducts.clear();
  saveSelectedProducts();

  const selectedButtons = productsContainer.querySelectorAll(
    ".product-card-select[aria-pressed='true']"
  );
  selectedButtons.forEach((button) => {
    button.setAttribute("aria-pressed", "false");
    button.closest(".product-card").classList.remove("selected");
  });

  displaySelectedProducts();
});

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  await productsReady;
  if (!productsLoaded) {
    return;
  }

  const selectedCategory = e.target.value;
  saveSelectedCategory(selectedCategory);

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = allProducts.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(filteredProducts);
});

/* Add a readable message to the chat window */
function displayChatMessage(speaker, content) {
  const messageElement = document.createElement("p");
  messageElement.textContent = `${speaker}: ${content}`;
  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return messageElement;
}

/* Send the current messages to the Cloudflare Worker */
async function sendMessagesToWorker(userMessage) {
  messages.push(userMessage);

  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: messages }),
    });

    if (!response.ok) {
      throw new Error(`The Worker returned status ${response.status}.`);
    }

    const data = await response.json();
    const reply =
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content;

    if (typeof reply !== "string" || !reply.trim()) {
      throw new Error("The Worker response did not contain a routine.");
    }

    messages.push({ role: "assistant", content: reply });
    return reply;
  } catch (error) {
    messages.pop();
    throw error;
  }
}

/* Generate a routine using only the currently selected products */
generateRoutine.addEventListener("click", async () => {
  if (selectedProducts.size === 0) {
    displayChatMessage("Assistant", "Select at least one product first.");
    return;
  }

  const productsForRoutine = Array.from(selectedProducts.values()).map(
    (product) => ({
      name: product.name,
      brand: product.brand,
      category: product.category,
      description: product.description,
    })
  );
  const userMessage = {
    role: "user",
    content: `Create a personalized routine using only these selected products. Use their names, brands, categories, and descriptions:\n\n${JSON.stringify(
      productsForRoutine,
      null,
      2
    )}`,
  };

  messages = [systemMessage];
  routineHasBeenGenerated = false;
  chatWindow.innerHTML = "";
  const statusMessage = displayChatMessage(
    "Assistant",
    "Creating your personalized routine..."
  );

  generateRoutine.disabled = true;
  chatSubmitButton.disabled = true;
  chatInput.disabled = true;

  try {
    const routine = await sendMessagesToWorker(userMessage);
    routineHasBeenGenerated = true;
    statusMessage.textContent = `Routine: ${routine}`;
  } catch (error) {
    console.error("Could not generate a routine:", error);
    statusMessage.textContent =
      "Assistant: Sorry, I could not generate a routine. Please try again.";
  } finally {
    generateRoutine.disabled = false;
    chatSubmitButton.disabled = false;
    chatInput.disabled = false;
  }
});

/* Send follow-up questions with the routine conversation history */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = chatInput.value.trim();

  if (!message) {
    return;
  }

  if (!routineHasBeenGenerated) {
    displayChatMessage("Assistant", "Generate a routine before asking a question.");
    return;
  }

  displayChatMessage("You", message);
  chatInput.value = "";
  const statusMessage = displayChatMessage("Assistant", "Thinking...");
  generateRoutine.disabled = true;
  chatSubmitButton.disabled = true;
  chatInput.disabled = true;

  try {
    const reply = await sendMessagesToWorker({
      role: "user",
      content: message,
    });
    statusMessage.textContent = `Assistant: ${reply}`;
  } catch (error) {
    console.error("Could not send the chat message:", error);
    statusMessage.textContent =
      "Assistant: Sorry, I could not send your message. Please try again.";
  } finally {
    generateRoutine.disabled = false;
    chatSubmitButton.disabled = false;
    chatInput.disabled = false;
  }
});
