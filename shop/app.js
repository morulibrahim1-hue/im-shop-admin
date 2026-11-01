const { createClient } = supabase;
const cfg = window.SUPABASE_CONFIG || window.supabaseConfig || {};
const client = createClient(
  cfg.url || cfg.supabaseUrl || "https://ubkultowuzonvkdqqihd.supabase.co",
  cfg.anonKey || cfg.publishableKey || "sb_publishable_PLhvJW8yWedj4K6rsl0ctA_1_8BPUI5"
);

let allProducts = [];
let cart = [];
let activeCategory = "all";

const productsBox = document.getElementById("products");
const searchBox = document.getElementById("search");
const categoriesBox = document.getElementById("categories");

function money(value) {
  return "৳" + Number(value || 0).toLocaleString("en-BD");
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}

async function loadStore() {
  productsBox.innerHTML = '<p class="notice">পণ্য লোড হচ্ছে…</p>';

  const { data, error } = await client
    .from("products")
    .select("id,name,description,price,stock_quantity,image_url,category_id,is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    productsBox.innerHTML = '<p class="notice">পণ্য দেখানো যাচ্ছে না। Supabase-এর public read permission পরীক্ষা করতে হবে।</p>';
    console.error(error);
    return;
  }

  allProducts = data || [];
  await loadCategories();
  renderProducts();
}

async function loadCategories() {
  const { data, error } = await client
    .from("categories")
    .select("id,name,is_active")
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.warn("Categories:", error.message);
    return;
  }

  categoriesBox.innerHTML =
    '<button class="selected" data-category="all">সব</button>' +
    (data || []).map(c =>
      `<button data-category="${escapeHTML(c.id)}">${escapeHTML(c.name)}</button>`
    ).join("");

  categoriesBox.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.category;
      categoriesBox.querySelectorAll("button").forEach(b => b.classList.remove("selected"));
      button.classList.add("selected");
      renderProducts();
    });
  });
}

function renderProducts() {
  const term = searchBox.value.trim().toLowerCase();

  const filtered = allProducts.filter(p => {
    const matchesText = String(p.name || "").toLowerCase().includes(term);
    const matchesCategory = activeCategory === "all" ||
      String(p.category_id) === activeCategory;
    return matchesText && matchesCategory;
  });

  if (!filtered.length) {
    productsBox.innerHTML = '<p class="notice">এখন কোনো পণ্য পাওয়া যায়নি।</p>';
    return;
  }

  productsBox.innerHTML = filtered.map(p => `
    <article class="product">
      ${p.image_url
        ? `<img src="${escapeHTML(p.image_url)}" alt="${escapeHTML(p.name)}" loading="lazy">`
        : '<div style="height:190px;background:#eee"></div>'}
      <div class="product-info">
        <h3>${escapeHTML(p.name)}</h3>
        <div class="price">${money(p.price)}</div>
        <div class="stock">${Number(p.stock_quantity || 0) > 0 ? "স্টকে আছে" : "স্টক শেষ"}</div>
        <button data-add="${escapeHTML(p.id)}" ${Number(p.stock_quantity || 0) <= 0 ? "disabled" : ""}>কার্টে যোগ করুন</button>
      </div>
    </article>
  `).join("");

  productsBox.querySelectorAll("[data-add]").forEach(button => {
    button.addEventListener("click", () => addToCart(button.dataset.add));
  });
}

function addToCart(id) {
  const product = allProducts.find(p => String(p.id) === String(id));
  if (!product) return;

  const existing = cart.find(item => String(item.id) === String(id));
  if (existing) {
    if (existing.quantity >= Number(product.stock_quantity || 0)) {
      alert("স্টকের বেশি পণ্য যোগ করা যাবে না।");
      return;
    }
    existing.quantity++;
  } else {
    cart.push({...product, quantity: 1});
  }
  renderCart();
}

function renderCart() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);

  document.getElementById("cartCount").textContent = count;
  document.getElementById("cartTotal").textContent = money(total);

  const box = document.getElementById("cartItems");
  if (!cart.length) {
    box.innerHTML = '<p class="notice">কার্টে এখনো কোনো পণ্য নেই।</p>';
    return;
  }

  box.innerHTML = cart.map(item => `
    <div class="cart-row">
      <span>${escapeHTML(item.name)} × ${item.quantity}</span>
      <span>${money(Number(item.price || 0) * item.quantity)}
      <button data-remove="${escapeHTML(item.id)}">−</button></span>
    </div>
  `).join("");

  box.querySelectorAll("[data-remove]").forEach(button => {
    button.addEventListener("click", () => {
      const item = cart.find(p => String(p.id) === button.dataset.remove);
      if (item) {
        item.quantity--;
        if (item.quantity <= 0) cart = cart.filter(p => p !== item);
        renderCart();
      }
    });
  });
}

searchBox.addEventListener("input", renderProducts);
loadStore();
