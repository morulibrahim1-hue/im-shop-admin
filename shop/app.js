const { createClient } = supabase;
const cfg = window.SUPABASE_CONFIG || window.supabaseConfig || {};
const client = createClient(
  cfg.url || cfg.supabaseUrl || "https://ubkultowuzonvkdqqihd.supabase.co",
  cfg.anonKey || cfg.publishableKey || "sb_publishable_PLhvJW8yWedj4K6rsl0ctA_1_8BPUI5"
);

let allProducts = [];
let allVariants = [];
let selectedOrder = null;
let activeCategory = "all";

const productsBox = document.getElementById("products");
const searchBox = document.getElementById("search");
const categoriesBox = document.getElementById("categories");

// Persistent customer back button: close the topmost shop panel first, then navigate back.
(() => {
  const back = document.getElementById('imGlobalBack');
  if (!back) return;
  const style = document.createElement('style');
  style.textContent = '#imGlobalBack{position:fixed;top:10px;left:10px;z-index:900;border:0;border-radius:22px;background:#172033;color:#fff;padding:10px 14px;font-weight:700;font-size:14px;box-shadow:0 3px 12px #0003;cursor:pointer}body{scroll-padding-top:60px}';
  document.head.appendChild(style);
  back.addEventListener('click', () => {
    const detail = document.getElementById('imProductDetailModal');
    if (detail?.classList.contains('open')) { detail.classList.remove('open'); return; }
    const drawer = document.getElementById('orderDrawer');
    if (drawer?.classList.contains('open')) { closeOrder(); return; }
    const chat = document.getElementById('imChatBox');
    if (chat?.classList.contains('open')) { chat.classList.remove('open'); return; }
    if (history.length > 1) history.back();
    else window.scrollTo({top:0,behavior:'smooth'});
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const detail = document.getElementById('imProductDetailModal');
    if (detail?.classList.contains('open')) detail.classList.remove('open');
    else if (document.getElementById('orderDrawer')?.classList.contains('open')) closeOrder();
    else if (document.getElementById('imChatBox')?.classList.contains('open')) document.getElementById('imChatBox').classList.remove('open');
  });
})();
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
  const variantResult = await client.from('product_variants').select('id,product_id,size,color,price,stock_quantity,is_active').eq('is_active', true);
  allVariants = variantResult.error ? [] : (variantResult.data || []);
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
  const filtered = allProducts.filter(p => String(p.name || '').toLowerCase().includes(term) && (activeCategory === 'all' || String(p.category_id) === activeCategory));
  if (!filtered.length) { productsBox.innerHTML = '<p class="notice">এখন কোনো পণ্য পাওয়া যায়নি।</p>'; return; }
  productsBox.innerHTML = filtered.map(p => {
    const opts = allVariants.filter(v => String(v.product_id) === String(p.id));
    const inStock = opts.length ? opts.some(v => Number(v.stock_quantity) > 0) : Number(p.stock_quantity || 0) > 0;
    const variantSelect = '';
    const details = '<div class="product-details" id="details-' + escapeHTML(p.id) + '" hidden><p>' + (p.description ? escapeHTML(p.description).replace(/\\n/g,'<br>') : 'এই পণ্যের বিস্তারিত বিবরণ এখনো যোগ করা হয়নি।') + '</p><p><b>দাম:</b> ' + money(p.price) + ' · <b>স্টক:</b> ' + Number(p.stock_quantity || 0) + '</p>' + (opts.length ? '<p><b>সাইজ/কালার ও আলাদা দাম:</b></p><ul>' + opts.map(v => '<li>' + escapeHTML([v.size,v.color].filter(Boolean).join(' / ') || 'ভ্যারিয়েন্ট') + ' — ' + money(v.price ?? p.price) + ' · স্টক ' + Number(v.stock_quantity || 0) + '</li>').join('') + '</ul>' : '') + '</div>';
    return '<article class="product">' + (p.image_url ? '<img src="' + escapeHTML(p.image_url) + '" alt="' + escapeHTML(p.name) + '" loading="lazy">' : '<div style="height:145px;background:#eee"></div>') + '<div class="product-info"><h3>' + escapeHTML(p.name) + '</h3><div class="price">' + money(p.price) + '</div><div class="stock">' + (inStock ? 'স্টকে আছে' : 'স্টক শেষ') + '</div><button type="button" class="details-toggle" data-details="' + escapeHTML(p.id) + '">বিস্তারিত দেখুন</button>' + details + variantSelect + '<button data-order="' + escapeHTML(p.id) + '" ' + (!inStock ? 'disabled' : '') + '>' + (inStock ? 'অর্ডার নাও' : 'স্টক শেষ') + '</button></div></article>';
  }).join('');
  // Open a focused product detail view when the customer taps its photo or title.
  productsBox.querySelectorAll('.product img, .product-info h3').forEach(target => {
    target.style.cursor = 'pointer';
    target.setAttribute('role', 'button');
    target.setAttribute('tabindex', '0');
    const open = () => openProductDetails(target.closest('.product').querySelector('[data-order]').dataset.order);
    target.addEventListener('click', open);
    target.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
  });
  productsBox.querySelectorAll('.details-toggle').forEach(button => button.addEventListener('click', () => {
    const panel = document.getElementById('details-' + button.dataset.details);
    const opening = panel.hidden;
    panel.hidden = !opening;
    button.textContent = opening ? 'বিস্তারিত বন্ধ করুন' : 'বিস্তারিত দেখুন';
  }));
  productsBox.querySelectorAll('[data-order]').forEach(button => button.addEventListener('click', () => openDirectOrder(button.dataset.order)));
}
function openProductDetails(id) {
  const p = allProducts.find(x => String(x.id) === String(id));
  if (!p) return;
  const opts = allVariants.filter(v => String(v.product_id) === String(id));
  let modal = document.getElementById('imProductDetailModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'imProductDetailModal';
    modal.innerHTML = '<div class="im-detail-backdrop" data-detail-close></div><section class="im-detail-sheet" role="dialog" aria-modal="true" aria-label="পণ্যের বিস্তারিত"><button class="im-detail-close" type="button" data-detail-close aria-label="বন্ধ">×</button><div id="imDetailContent"></div></section>';
    document.body.appendChild(modal);
    const style = document.createElement('style');
    style.textContent = '#imProductDetailModal{position:fixed;inset:0;z-index:1000;display:none}#imProductDetailModal.open{display:block}.im-detail-backdrop{position:absolute;inset:0;background:#0009}.im-detail-sheet{position:absolute;inset:3vh 0 0;background:#fff;border-radius:20px 20px 0 0;overflow:auto;padding:18px 16px 30px;max-width:650px;margin:auto}.im-detail-close{position:sticky;top:0;float:right;border:0;border-radius:50%;width:40px;height:40px;font-size:28px;background:#f1f1f1;z-index:2}.im-detail-image{display:block;width:100%;height:min(48vh,420px);object-fit:contain;background:#f7f7f7;border-radius:12px;margin:8px 0 16px}.im-detail-title{font-size:22px;margin:8px 0}.im-detail-description{white-space:pre-wrap;line-height:1.65;color:#333}.im-detail-variants{padding-left:22px;line-height:1.8}';
    document.head.appendChild(style);
    modal.querySelectorAll('[data-detail-close]').forEach(el => el.addEventListener('click', () => modal.classList.remove('open')));
  }
  const image = p.image_url ? '<img class="im-detail-image" src="' + escapeHTML(p.image_url) + '" alt="' + escapeHTML(p.name) + '">' : '';
  const variants = opts.length ? '<h3>সাইজ ও কালার</h3><ul class="im-detail-variants">' + opts.map(v => '<li>' + escapeHTML([v.size,v.color].filter(Boolean).join(' / ') || 'ভ্যারিয়েন্ট') + ' — ' + money(v.price ?? p.price) + ' · ' + (Number(v.stock_quantity)>0?'স্টকে আছে':'স্টক শেষ') + '</li>').join('') + '</ul>' : '';
  document.getElementById('imDetailContent').innerHTML = image + '<h2 class="im-detail-title">' + escapeHTML(p.name) + '</h2><p><b>' + money(p.price) + '</b> · ' + (Number(p.stock_quantity)>0?'স্টকে আছে':'স্টক শেষ') + '</p><div class="im-detail-description">' + (p.description ? escapeHTML(p.description) : 'এই পণ্যের বিস্তারিত বিবরণ এখনো যোগ করা হয়নি।') + '</div>' + variants;
  modal.classList.add('open');
}
function openDirectOrder(id) {
  const p = allProducts.find(x => String(x.id) === String(id)); if (!p) return;
  const opts = allVariants.filter(v => String(v.product_id) === String(id));
  const available = opts.filter(v => Number(v.stock_quantity) > 0);
  const stock = opts.length ? available.reduce((sum,v)=>sum+Number(v.stock_quantity||0),0) : Number(p.stock_quantity||0);
  if (stock < 1) { alert('এই পণ্যটি স্টকে নেই।'); return; }
  selectedOrder = {product_id:p.id, variant_id:null, name:p.name, variant:'', price:Number(p.price), stock:stock, variants:opts};
  const image = p.image_url ? '<img src="' + escapeHTML(p.image_url) + '" alt="">' : '';
  document.getElementById('orderProduct').innerHTML = image + '<div><b>' + escapeHTML(p.name) + '</b><span>' + money(p.price) + ' · স্টক ' + stock + '</span></div>';
  const variantField = document.getElementById('checkoutVariantField');
  if (variantField) {
    variantField.hidden = !opts.length;
    const select = document.getElementById('checkoutVariant');
    select.innerHTML = '<option value="">সাইজ/কালার বাছুন</option>' + available.map(v=>'<option value="'+escapeHTML(v.id)+'">'+escapeHTML([v.size,v.color].filter(Boolean).join(' / ')||'ভ্যারিয়েন্ট')+' — '+money(v.price??p.price)+' · স্টক '+Number(v.stock_quantity)+'</option>').join('');
    select.required = !!opts.length;
  }
  const qty = document.getElementById('checkout').elements.quantity; qty.max = Math.min(stock,20); qty.value = 1;
  document.getElementById('checkoutMsg').textContent = ''; const drawer=document.getElementById('orderDrawer'); drawer.classList.add('open'); drawer.setAttribute('aria-hidden','false');
}
document.getElementById('checkoutVariant')?.addEventListener('change', e => {
  if (!selectedOrder) return;
  const v = selectedOrder.variants.find(x=>String(x.id)===String(e.target.value));
  if (!v) { selectedOrder.variant_id=null; selectedOrder.variant=''; selectedOrder.price=Number(allProducts.find(p=>String(p.id)===String(selectedOrder.product_id))?.price||0); return; }
  selectedOrder.variant_id=v.id;
  selectedOrder.variant=[v.size,v.color].filter(Boolean).join(' / ');
  selectedOrder.price=Number(v.price??allProducts.find(p=>String(p.id)===String(selectedOrder.product_id))?.price??0);
  selectedOrder.stock=Number(v.stock_quantity||0);
  const qty=document.getElementById('checkout').elements.quantity; qty.max=Math.min(selectedOrder.stock,20); if(Number(qty.value)>selectedOrder.stock) qty.value=selectedOrder.stock;
  const p=allProducts.find(p=>String(p.id)===String(selectedOrder.product_id));
  document.getElementById('orderProduct').querySelector('span').textContent=selectedOrder.variant+' · '+money(selectedOrder.price)+' · স্টক '+selectedOrder.stock;
});
function closeOrder() { const drawer=document.getElementById('orderDrawer'); drawer.classList.remove('open'); drawer.setAttribute('aria-hidden','true'); }
document.getElementById('closeOrder').addEventListener('click', closeOrder);
document.getElementById('orderDrawer').addEventListener('click', e => { if (e.target.id === 'orderDrawer') closeOrder(); });
document.getElementById('checkout').addEventListener('submit', async e => {
  e.preventDefault(); if (!selectedOrder) return;
  const form=e.currentTarget, data=new FormData(form), qty=Number(data.get('quantity')), msg=document.getElementById('checkoutMsg'), btn=document.getElementById('submitOrder');
  if (selectedOrder.variants.length && !selectedOrder.variant_id) { msg.textContent='অর্ডারের আগে সাইজ/কালার নির্বাচন করুন।'; return; }
  const zone=String(data.get('delivery_zone')||''), district=String(data.get('district')||'').trim().toLowerCase();
  const isDhakaDistrict=['ঢাকা','dhaka'].includes(district);
  if (!zone) { msg.textContent='ঢাকার ভিতরে নাকি ঢাকার বাইরে—নির্বাচন করুন।'; return; }
  if ((zone==='ঢাকার ভিতরে' && !isDhakaDistrict) || (zone==='ঢাকার বাইরে' && isDhakaDistrict)) { msg.textContent='আপনার নির্বাচিত এলাকা ও জেলার নাম মিলছে না। সঠিকভাবে নির্বাচন করুন।'; return; }
  if (!Number.isInteger(qty) || qty < 1 || qty > selectedOrder.stock || qty > 20) { msg.textContent='সঠিক পরিমাণ দিন। স্টক: ' + selectedOrder.stock; return; }
  btn.disabled=true; btn.textContent='অর্ডার পাঠানো হচ্ছে…'; msg.textContent='';
  try {
    const result=await client.rpc('create_public_order',{p_customer_name:String(data.get('name')).trim(),p_customer_phone:String(data.get('phone')).trim(),p_district:String(data.get('district')).trim(),p_thana:String(data.get('thana')).trim(),p_address:String(data.get('address')).trim(),p_delivery_area:String(data.get('area')||'').trim(),p_items:[{product_id:selectedOrder.product_id,variant_id:selectedOrder.variant_id,quantity:qty}],p_notes:String(data.get('notes')||'').trim()});
    if(result.error) throw result.error; const order=result.data?.order || result.data;
    if(!order?.order_number) throw new Error('অর্ডার নম্বর পাওয়া যায়নি।');
    msg.textContent='অর্ডার সফল! নম্বর: '+order.order_number+' · পণ্যের মূল্য: '+money(order.subtotal)+' · ডেলিভারি: '+money(order.delivery_fee)+' · মোট: '+money(order.total);
    form.reset(); selectedOrder=null;
  } catch(err) { msg.textContent='অর্ডার করা যায়নি: '+(err.message||'সংযোগ সমস্যা'); }
  finally { btn.disabled=false; btn.textContent='অর্ডার কনফার্ম করুন'; }
});
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
