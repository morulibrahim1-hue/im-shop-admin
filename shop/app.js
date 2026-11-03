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


/* I M SHOP customer support chat widget */
(() => {
  const style = document.createElement("style");
  style.textContent = `
  #imChatLauncher{position:fixed;right:18px;bottom:18px;z-index:30;border:0;border-radius:28px;background:#f5c542;color:#111827;font-weight:700;padding:14px 19px;box-shadow:0 5px 22px #0003}
  #imChatBox{position:fixed;right:16px;bottom:78px;z-index:31;width:min(360px,calc(100vw - 24px));height:min(510px,calc(100vh - 110px));background:white;border:1px solid #ddd;border-radius:16px;box-shadow:0 8px 35px #0003;display:none;overflow:hidden;flex-direction:column;font-family:Arial,sans-serif}
  #imChatBox.open{display:flex}#imChatHead{background:#172033;color:white;padding:14px;display:flex;justify-content:space-between;align-items:center}
  #imChatHead button{background:transparent;color:white;border:0;font-size:22px}#imChatIntro{padding:10px 13px;background:#f7f7f8;font-size:13px;color:#555}
  #imChatMessages{flex:1;overflow:auto;padding:12px;background:#f7f7f8}
  .im-chat-msg{max-width:85%;padding:9px 11px;border-radius:12px;margin:7px 0;background:white;overflow-wrap:anywhere;font-size:14px}
  .im-chat-msg.customer{margin-left:auto;background:#fff0bc}.im-chat-msg small{display:block;color:#777;font-size:10px;margin-top:5px}
  #imChatForm{padding:10px;display:grid;gap:7px;border-top:1px solid #eee}
  #imChatForm input,#imChatForm textarea{width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font:inherit}
  #imChatForm textarea{resize:vertical;min-height:58px}#imChatForm button{border:0;border-radius:8px;padding:11px;background:#172033;color:white;font-weight:bold}
  #imChatStatus{font-size:12px;color:#777;min-height:15px}
  `;
  document.head.appendChild(style);
  const root=document.createElement("div");
  root.innerHTML='<button id="imChatLauncher" type="button">💬 আমাদের সাথে কথা বলুন</button><section id="imChatBox" aria-label="কাস্টমার সাপোর্ট চ্যাট"><header id="imChatHead"><b>I M SHOP সহায়তা</b><button id="imChatClose" type="button" aria-label="বন্ধ">×</button></header><div id="imChatIntro">আপনার প্রশ্ন লিখুন, আমরা উত্তর দেব।</div><div id="imChatMessages" aria-live="polite"><p class="notice">চ্যাট শুরু করতে নাম ও মেসেজ দিন।</p></div><form id="imChatForm"><input name="name" maxlength="100" placeholder="আপনার নাম" required><input name="phone" maxlength="30" inputmode="tel" placeholder="মোবাইল নম্বর (ঐচ্ছিক)"><textarea name="body" maxlength="3000" placeholder="আপনার মেসেজ লিখুন…" required></textarea><div id="imChatStatus"></div><button type="submit">মেসেজ পাঠান</button></form></section>';
  document.body.appendChild(root);
  const box=document.getElementById("imChatBox"),form=document.getElementById("imChatForm"),msgs=document.getElementById("imChatMessages"),status=document.getElementById("imChatStatus");
  const key="imshop_support_session_v1";let session=null,poll=null,busy=false;
  try{session=JSON.parse(localStorage.getItem(key)||"null")}catch{}
  function say(t){status.textContent=t}
  function render(rows){
    msgs.innerHTML=rows.length?rows.map(m=>'<article class="im-chat-msg '+(m.sender_type==="customer"?"customer":"admin")+'">'+escapeHTML(m.body)+'<small>'+(m.sender_type==="admin"?"I M SHOP":"আপনি")+' · '+new Date(m.created_at).toLocaleString("bn-BD")+'</small></article>').join(""):'<p class="notice">এখনো কোনো মেসেজ নেই।</p>';
    msgs.scrollTop=msgs.scrollHeight;
  }
  async function refresh(){
    if(!session)return;
    const {data,error}=await client.rpc("public_support_messages",{p_conversation_id:session.id,p_token:session.token});
    if(error){say("চ্যাট সংযোগ হচ্ছে না। পরে আবার চেষ্টা করুন।");return}
    render(data||[]);
    if(data?.[0]?.status==="closed"){say("এই কথোপকথনটি বন্ধ করা হয়েছে।");form.querySelector("button").disabled=true}
  }
  document.getElementById("imChatLauncher").onclick=()=>{box.classList.add("open");if(session)refresh();};
  document.getElementById("imChatClose").onclick=()=>box.classList.remove("open");
  if(session){form.elements.name.value=session.name||"";form.elements.phone.value=session.phone||"";form.elements.name.readOnly=true;form.elements.phone.readOnly=true;say("আগের কথোপকথন চালু আছে।");}
  form.onsubmit=async ev=>{
    ev.preventDefault();if(busy)return;
    const name=form.elements.name.value.trim(),phone=form.elements.phone.value.trim(),body=form.elements.body.value.trim();
    if(!body)return;busy=true;const btn=form.querySelector("button");btn.disabled=true;say("পাঠানো হচ্ছে…");
    try{
      if(!session){
        const {data,error}=await client.rpc("create_public_support_chat",{p_name:name,p_phone:phone,p_subject:"ওয়েবসাইট থেকে বার্তা",p_body:body});
        if(error)throw error;
        session={id:data.conversation_id,token:data.token,name,phone};localStorage.setItem(key,JSON.stringify(session));
        form.elements.name.readOnly=true;form.elements.phone.readOnly=true;
      }else{
        const {error}=await client.rpc("public_support_send",{p_conversation_id:session.id,p_token:session.token,p_body:body});if(error)throw error;
      }
      form.elements.body.value="";say("মেসেজ পাঠানো হয়েছে।");await refresh();
    }catch(err){say("পাঠানো যায়নি: "+(err.message||"সংযোগ সমস্যা"))}
    finally{busy=false;btn.disabled=false}
  };
  setInterval(()=>{if(box.classList.contains("open"))refresh()},8000);
})();
