(() => {
  const cfg=window.IMSHOP_CONFIG||{}, $=id=>document.getElementById(id);
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money=n=>"৳"+Number(n||0).toLocaleString("en-BD");
  const note=(id,msg,bad=false)=>{const e=$(id);if(e){e.textContent=msg;e.className="message "+(bad?"error":"success");}};
  const table=(heads,rows)=>rows.length?'<div class="table-wrap"><table><thead><tr>'+heads.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>':'<p class="muted pad">এখনো কোনো তথ্য পাওয়া যায়নি।</p>';
  async function categories(){
    const el=$("categoriesPanel"); if(!el)return;
    const {data,error}=await db.from("categories").select("id,name,is_active,sort_order").order("sort_order");
    el.innerHTML='<form id="catForm" class="module-form"><label>নতুন ক্যাটাগরির নাম<input id="catName" required maxlength="100" placeholder="যেমন: জুতা"></label><button class="primary">ক্যাটাগরি যোগ করুন</button><p id="catMsg" class="message"></p></form>'+(error?'<p class="error">'+esc(error.message)+'</p>':table(["ক্যাটাগরি","অবস্থা","কাজ"],(data||[]).map(c=>'<tr><td>'+esc(c.name)+'</td><td>'+(c.is_active?'সক্রিয়':'বন্ধ')+'</td><td><button class="secondary cat-toggle" data-id="'+c.id+'" data-active="'+c.is_active+'">'+(c.is_active?'বন্ধ করুন':'সক্রিয় করুন')+'</button></td></tr>')));
    $("catForm").onsubmit=async e=>{e.preventDefault();const name=$("catName").value.trim();const {error}=await db.from("categories").insert({name,is_active:true,sort_order:(data||[]).length+1});note("catMsg",error?error.message:"ক্যাটাগরি যোগ হয়েছে",!!error);if(!error)categories();};
    el.querySelectorAll(".cat-toggle").forEach(b=>b.onclick=async()=>{const {error}=await db.from("categories").update({is_active:b.dataset.active!=="true"}).eq("id",b.dataset.id);if(error)alert(error.message);else categories();});
  }
  async function inventory(){
    const el=$("inventoryPanel");if(!el)return;
    const {data,error}=await db.from("products").select("id,name,sku,stock_quantity,is_active").order("name").limit(200);
    el.innerHTML=error?'<p class="error">'+esc(error.message)+'</p>':table(["পণ্য","SKU","বর্তমান স্টক","স্টক আপডেট"],(data||[]).map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+esc(p.sku||"—")+'</td><td>'+Number(p.stock_quantity||0)+'</td><td><form class="stock-form" data-id="'+p.id+'"><input aria-label="নতুন স্টক" type="number" min="0" value="'+Number(p.stock_quantity||0)+'"><button class="secondary">সংরক্ষণ</button></form></td></tr>')));
    el.querySelectorAll(".stock-form").forEach(f=>f.onsubmit=async e=>{e.preventDefault();const value=Number(f.querySelector("input").value);const {error}=await db.from("products").update({stock_quantity:value}).eq("id",f.dataset.id);if(error)alert("স্টক আপডেট হয়নি: "+error.message);else{alert("স্টক আপডেট হয়েছে");inventory();}});
    const low=(data||[]).filter(p=>Number(p.stock_quantity||0)<=5);
    el.insertAdjacentHTML("afterbegin",'<div class="module-kpis"><article><b>'+low.length+'</b><span>কম স্টক (৫ বা কম)</span></article><article><b>'+(data||[]).length+'</b><span>মোট তালিকাভুক্ত পণ্য</span></article></div>');
  }
  async function customers(){
    const el=$("customersPanel");if(!el)return;
    const {data,error}=await db.from("customers").select("*").order("created_at",{ascending:false}).limit(100);
    el.innerHTML=error?'<p class="error">'+esc(error.message)+'</p>':table(["নাম","মোবাইল","ইমেইল","যোগদানের তারিখ"],(data||[]).map(c=>'<tr><td>'+esc(c.full_name||c.name||"—")+'</td><td>'+esc(c.phone||"—")+'</td><td>'+esc(c.email||"—")+'</td><td>'+esc(c.created_at?new Date(c.created_at).toLocaleDateString("bn-BD"):"—")+'</td></tr>'));
  }
  async function reports(){
    const el=$("reportsPanel");if(!el)return;
    const {data,error}=await db.from("orders").select("id,total,status,created_at").order("created_at",{ascending:false}).limit(500);
    if(error){el.innerHTML='<p class="error">'+esc(error.message)+'</p>';return;}
    const rows=data||[], valid=rows.filter(x=>x.status!=="cancelled"),sum=valid.reduce((a,x)=>a+Number(x.total||0),0);
    el.innerHTML='<div class="module-kpis"><article><b>'+rows.length+'</b><span>মোট অর্ডার</span></article><article><b>'+valid.length+'</b><span>বাতিল বাদে অর্ডার</span></article><article><b>'+money(sum)+'</b><span>অর্ডারের মোট মূল্য (আনুমানিক)</span></article></div>'+table(["তারিখ","অর্ডার মূল্য","স্ট্যাটাস"],rows.slice(0,50).map(x=>'<tr><td>'+new Date(x.created_at).toLocaleDateString("bn-BD")+'</td><td>'+money(x.total)+'</td><td>'+esc(x.status)+'</td></tr>'));
  }
  async function simpleRead(id,tableName,columns,heads,mapper){
    const el=$(id);if(!el)return;const {data,error}=await db.from(tableName).select(columns).limit(100);
    el.innerHTML=error?'<p class="error">'+esc(error.message)+'</p>':table(heads,(data||[]).map(mapper));
  }
  async function marketing(){await simpleRead("marketingPanel","coupons","*",
    ["কুপন কোড","ডিসকাউন্ট","অবস্থা"],c=>'<tr><td>'+esc(c.code||c.coupon_code||"—")+'</td><td>'+esc(c.discount_value??c.discount??"—")+'</td><td>'+esc(c.is_active===false?"বন্ধ":"সক্রিয়")+'</td></tr>');}
  async function notifications(){await simpleRead("notificationsPanel","notifications","*",
    ["শিরোনাম","বার্তা","তারিখ"],n=>'<tr><td>'+esc(n.title||"—")+'</td><td>'+esc(n.message||n.body||"—")+'</td><td>'+esc(n.created_at?new Date(n.created_at).toLocaleString("bn-BD"):"—")+'</td></tr>');}
  function settings(){
    const el=$("settingsPanel");if(!el)return;
    el.innerHTML='<div class="feature-grid"><article class="feature-card"><h4>দোকানের তথ্য</h4><label>দোকানের নাম<input id="shopName" value="I M SHOP"></label><label>যোগাযোগ নম্বর<input id="shopPhone" placeholder="মোবাইল নম্বর"></label><label>ঠিকানা<textarea id="shopAddress" rows="2" placeholder="দোকানের ঠিকানা"></textarea></label><button class="secondary" id="saveShop">এই ডিভাইসে খসড়া সংরক্ষণ</button><small>এটি আপাতত এই ব্রাউজারে খসড়া হিসেবে থাকবে; সার্ভারে সেভ নয়।</small></article><article class="feature-card"><h4>ডেলিভারি চার্জ</h4><label>ঢাকার ভিতরে (৳)<input id="chargeDhaka" type="number" min="0" value="70"></label><label>ঢাকার বাইরে (৳)<input id="chargeOutside" type="number" min="0" value="120"></label><button class="secondary" id="saveCharge">খসড়া সংরক্ষণ</button><small>চেকআউটের সঙ্গে যুক্ত করা এখনো বাকি।</small></article></div>';
    const keys=["shopName","shopPhone","shopAddress","chargeDhaka","chargeOutside"];
    keys.forEach(k=>{const v=localStorage.getItem("imshop_"+k);if(v!==null&&$(k))$(k).value=v;});
    ["saveShop","saveCharge"].forEach(id=>$(id).onclick=()=>{keys.forEach(k=>localStorage.setItem("imshop_"+k,$(k).value));alert("এই ব্রাউজারে খসড়া সংরক্ষিত হয়েছে।");});
  }
  function payments(){const el=$("paymentsPanel");if(el)el.innerHTML='<div class="feature-grid"><article class="feature-card"><h4>ক্যাশ অন ডেলিভারি</h4><p>বর্তমান অর্ডার প্রক্রিয়ায় COD ব্যবহারের জন্য প্রস্তুত রাখুন।</p><span class="status">ম্যানুয়াল যাচাই</span></article><article class="feature-card"><h4>অনলাইন পেমেন্ট</h4><p>bKash, Nagad ও কার্ড গেটওয়ে যুক্ত করার জন্য মার্চেন্ট API ও সার্ভার-সাইড যাচাই দরকার।</p><span class="status">সংযোগ বাকি</span></article></div>';}
  function delivery(){const el=$("deliveryPanel");if(el)el.innerHTML='<div class="feature-grid"><article class="feature-card"><h4>ঢাকা</h4><b>৳৭০</b><p>প্রাথমিক ডেলিভারি চার্জ — সেটিংসে খসড়া পরিবর্তন করা যায়।</p></article><article class="feature-card"><h4>ঢাকার বাইরে</h4><b>৳১২০</b><p>প্রাথমিক ডেলিভারি চার্জ — কুরিয়ার API সংযোগ বাকি।</p></article><article class="feature-card"><h4>কুরিয়ার</h4><p>Steadfast / Pathao সংযোগের জন্য API credential প্রয়োজন।</p><span class="status">সংযোগ বাকি</span></article></div>';}
  function security(){const el=$("securityPanel");if(el)el.innerHTML='<div class="feature-grid"><article class="feature-card"><h4>অ্যাকাউন্ট যাচাই</h4><p>Supabase ইমেইল ও পাসওয়ার্ড দিয়ে লগইন; staff_profiles-এ সক্রিয় Admin যাচাই করা হয়।</p><span class="status">চালু</span></article><article class="feature-card"><h4>OTP / MFA</h4><p>অ্যাডমিনের জন্য OTP/MFA চালু করতে Supabase Auth MFA ও ইমেইল/Authenticator নীতি কনফিগার করতে হবে।</p><span class="status">সার্ভার কনফিগারেশন বাকি</span></article><article class="feature-card"><h4>স্টাফ অনুমতি</h4><p>বর্তমান সংস্করণে Admin/Manager/Staff ভূমিকা আছে; সূক্ষ্ম Permission Matrix সার্ভার-পলিসির সঙ্গে যুক্ত করতে হবে।</p><span class="status">বর্ধিত অনুমতি বাকি</span></article></div>';}
  const loaders={categories,inventory,customers,reports,settings,payments,delivery,marketing,notifications,security};
  let active=false;
  function boot(){if(active)return;active=true;Object.values(loaders).forEach(fn=>{try{fn();}catch(e){console.error(e);}});document.getElementById("sideNav")?.addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b&&loaders[b.dataset.page])loaders[b.dataset.page]();});}
  db.auth.onAuthStateChange((event,session)=>{if(session?.user) setTimeout(boot,100);else active=false;});
  db.auth.getSession().then(({data})=>{if(data.session?.user)boot();});
})();

/* Product administration enhancements: safe inline editing using known products columns. */
(() => {
  const cfg=window.IMSHOP_CONFIG||{}, $=id=>document.getElementById(id);
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  async function render(){
    const el=$("productsList");if(!el)return;
    el.innerHTML='<p class="pad muted">পণ্য লোড হচ্ছে…</p>';
    const {data,error}=await db.from("products").select("id,name,sku,price,stock_quantity,is_active,is_featured,created_at").order("created_at",{ascending:false}).limit(200);
    if(error){el.innerHTML='<p class="pad error">'+esc(error.message)+'</p>';return;}
    if(!data?.length){el.innerHTML='<p class="pad muted">এখনো কোনো পণ্য নেই। “পণ্য যোগ করুন” থেকে যোগ করুন।</p>';return;}
    el.innerHTML='<div class="module-kpis"><article><b>'+data.length+'</b><span>পণ্য</span></article><article><b>'+data.filter(p=>p.is_active).length+'</b><span>সক্রিয়</span></article><article><b>'+data.filter(p=>Number(p.stock_quantity||0)<=5).length+'</b><span>কম স্টক</span></article></div><div class="table-wrap"><table><thead><tr><th>পণ্য</th><th>দাম</th><th>স্টক</th><th>অবস্থা</th><th>কাজ</th></tr></thead><tbody>'+data.map(p=>'<tr><td><b>'+esc(p.name)+'</b><br><small>'+esc(p.sku||"SKU নেই")+'</small></td><td><input class="edit-price" type="number" min="0" step="0.01" value="'+Number(p.price||0)+'" aria-label="দাম"></td><td><input class="edit-stock" type="number" min="0" step="1" value="'+Number(p.stock_quantity||0)+'" aria-label="স্টক"></td><td>'+(p.is_active?'সক্রিয়':'বন্ধ')+'</td><td><button class="secondary save-product" data-id="'+p.id+'">সংরক্ষণ</button> <button class="secondary toggle-product" data-id="'+p.id+'" data-active="'+p.is_active+'">'+(p.is_active?'বন্ধ':'সক্রিয়')+'</button></td></tr>').join("")+'</tbody></table></div>';
    el.querySelectorAll(".save-product").forEach(b=>b.onclick=async()=>{const tr=b.closest("tr"),price=Number(tr.querySelector(".edit-price").value),stock=Number(tr.querySelector(".edit-stock").value);if(price<0||stock<0||!Number.isFinite(price)||!Number.isInteger(stock)){alert("দাম ও স্টক সঠিকভাবে লিখুন।");return;}b.disabled=true;const {error}=await db.from("products").update({price,stock_quantity:stock}).eq("id",b.dataset.id);if(error)alert("সংরক্ষণ হয়নি: "+error.message);else alert("পণ্যের দাম ও স্টক সংরক্ষিত হয়েছে।");b.disabled=false;});
    el.querySelectorAll(".toggle-product").forEach(b=>b.onclick=async()=>{b.disabled=true;const {error}=await db.from("products").update({is_active:b.dataset.active!=="true"}).eq("id",b.dataset.id);if(error)alert("অবস্থা পরিবর্তন হয়নি: "+error.message);else render();});
  }
  function hook(){
    const nav=$("sideNav");if(nav&&!nav.dataset.productEnhance){nav.dataset.productEnhance="1";nav.addEventListener("click",e=>{if(e.target.closest('[data-page="products"]'))setTimeout(render,120);});}
    const exp=$("reportsPanel");if(exp&&!exp.dataset.csv){exp.dataset.csv="1";const b=document.createElement("button");b.className="secondary";b.textContent="রিপোর্ট CSV ডাউনলোড";b.style.margin="12px 0";b.onclick=async()=>{const {data,error}=await db.from("orders").select("order_number,customer_name,total,status,created_at").order("created_at",{ascending:false}).limit(2000);if(error){alert(error.message);return;}const q=v=>'"'+String(v??"").replace(/"/g,'""')+'"';const csv=["Order,Customer,Total,Status,Date",...(data||[]).map(x=>[x.order_number,x.customer_name,x.total,x.status,x.created_at].map(q).join(","))].join("\\n");const url=URL.createObjectURL(new Blob(["\\ufeff"+csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="im-shop-orders.csv";a.click();URL.revokeObjectURL(url);};exp.prepend(b);}
  }
  const wait=setInterval(()=>{if($("sideNav")&&$("reportsPanel")){clearInterval(wait);hook();}},300);
  const original=window.addEventListener;document.addEventListener("click",e=>{if(e.target.closest('[data-page="reports"]'))setTimeout(hook,150);});
  db.auth.getSession().then(({data})=>{if(data.session?.user)setTimeout(hook,500);});
  db.auth.onAuthStateChange((event,session)=>{if(session?.user)setTimeout(hook,300);});
})();


/* Advanced admin modules backed by additive admin_app_* tables. */
(() => {
 const C=window.IMSHOP_CONFIG||{};if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY),$=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const money=v=>"৳"+Number(v||0).toLocaleString("en-BD");
 const msg=(id,s)=>{const e=$(id);if(e)e.textContent=s;};
 const table=(headers,rows)=>'<div class="table-wrap"><table><thead><tr>'+headers.map(x=>'<th>'+x+'</th>').join("")+'</tr></thead><tbody>'+(rows.length?rows.join(""):'<tr><td colspan="'+headers.length+'">কোনো তথ্য নেই</td></tr>')+'</tbody></table></div>';
 async function rows(t,cols="*"){const r=await db.from(t).select(cols).order("created_at",{ascending:false}).limit(150);if(r.error)throw r.error;return r.data||[];}
 async function settings(){
  const e=$("settingsPanel");if(!e)return;
  let {data,error}=await db.from("admin_app_settings").select("key,value");
  if(error){e.innerHTML='<p class="error">'+esc(error.message)+' — প্রথমে SQL migration চালান।</p>';return;}
  const v=Object.fromEntries((data||[]).map(x=>[x.key,x.value]));
  e.innerHTML='<form id="advSettings" class="module-form"><h3>দোকানের তথ্য</h3><label>দোকানের নাম<input name="store_name" value="'+esc(v.store_name?.value||"I M SHOP")+'"></label><label>মোবাইল<input name="phone" value="'+esc(v.phone?.value||"")+'"></label><label>ঠিকানা<textarea name="address">'+esc(v.address?.value||"")+'</textarea></label><button class="primary">সার্ভারে সংরক্ষণ</button><p id="advSettingsMsg"></p></form>';
  $("advSettings").onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget);for(const k of ["store_name","phone","address"]){const {error}=await db.from("admin_app_settings").upsert({key:k,value:{value:f.get(k)},updated_at:new Date().toISOString()});if(error){msg("advSettingsMsg",error.message);return;}}msg("advSettingsMsg","সেটিংস সার্ভারে সংরক্ষিত হয়েছে।");};
 }
 async function coupons(){
  const e=$("marketingPanel");if(!e)return;
  const data=await rows("admin_app_coupons");
  e.innerHTML='<form id="couponForm" class="module-form"><h3>নতুন কুপন</h3><label>কুপন কোড<input name="code" required maxlength="40"></label><label>ধরন<select name="discount_type"><option value="fixed">নির্দিষ্ট টাকা</option><option value="percent">শতকরা</option></select></label><label>ডিসকাউন্ট<input name="discount_value" type="number" min="0" step="0.01" required></label><label>ন্যূনতম অর্ডার<input name="min_order" type="number" min="0" value="0"></label><label>সর্বোচ্চ ব্যবহার (ঐচ্ছিক)<input name="max_uses" type="number" min="1"></label><label>মেয়াদ শেষ<input name="expires_at" type="datetime-local"></label><button class="primary">কুপন তৈরি</button><p id="couponMsg"></p></form>'+table(["কোড","ছাড়","ব্যবহার","অবস্থা","কাজ"],data.map(x=>'<tr><td>'+esc(x.code)+'</td><td>'+esc(x.discount_type==="percent"?x.discount_value+"%":money(x.discount_value))+'</td><td>'+x.used_count+'/'+(x.max_uses??"∞")+'</td><td>'+(x.is_active?"সক্রিয়":"বন্ধ")+'</td><td><button class="secondary couponToggle" data-id="'+x.id+'" data-on="'+x.is_active+'">'+(x.is_active?"বন্ধ":"চালু")+'</button></td></tr>'));
  $("couponForm").onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget);const payload={code:String(f.get("code")).trim().toUpperCase(),discount_type:f.get("discount_type"),discount_value:Number(f.get("discount_value")),min_order:Number(f.get("min_order")||0),max_uses:f.get("max_uses")?Number(f.get("max_uses")):null,expires_at:f.get("expires_at")?new Date(f.get("expires_at")).toISOString():null};const {error}=await db.from("admin_app_coupons").insert(payload);msg("couponMsg",error?error.message:"কুপন তৈরি হয়েছে");if(!error)coupons();};
  e.querySelectorAll(".couponToggle").forEach(b=>b.onclick=async()=>{const {error}=await db.from("admin_app_coupons").update({is_active:b.dataset.on!=="true"}).eq("id",b.dataset.id);if(error)alert(error.message);else coupons();});
 }
 async function banners(){
  const e=$("marketingPanel");if(!e)return;
  const data=await rows("admin_app_banners");
  const existing=e.innerHTML;
  e.innerHTML='<form id="bannerForm" class="module-form"><h3>স্টোর ব্যানার / স্লাইডার যোগ</h3><label>শিরোনাম<input name="title" required></label><label>ছবির URL<input name="image_url" type="url" placeholder="https://..."></label><label>লিংক (ঐচ্ছিক)<input name="target_url" type="url"></label><label>ক্রম<input name="sort_order" type="number" value="0"></label><button class="primary">ব্যানার সংরক্ষণ</button><p id="bannerMsg"></p></form>'+existing+table(["শিরোনাম","ছবি","অবস্থা","কাজ"],data.map(x=>'<tr><td>'+esc(x.title)+'</td><td>'+(x.image_url?'<a href="'+esc(x.image_url)+'" target="_blank" rel="noopener">দেখুন</a>':"—")+'</td><td>'+(x.is_active?"সক্রিয়":"বন্ধ")+'</td><td><button class="secondary bannerToggle" data-id="'+x.id+'" data-on="'+x.is_active+'">অবস্থা বদল</button></td></tr>'));
  $("bannerForm").onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget);const {error}=await db.from("admin_app_banners").insert({title:f.get("title"),image_url:f.get("image_url")||null,target_url:f.get("target_url")||null,sort_order:Number(f.get("sort_order")||0)});msg("bannerMsg",error?error.message:"ব্যানার সংরক্ষিত হয়েছে");if(!error)banners();};
  e.querySelectorAll(".bannerToggle").forEach(b=>b.onclick=async()=>{const {error}=await db.from("admin_app_banners").update({is_active:b.dataset.on!=="true"}).eq("id",b.dataset.id);if(error)alert(error.message);else banners();});
 }
 async function delivery(){
  const e=$("deliveryPanel");if(!e)return;const data=await rows("admin_app_delivery_zones");
  e.innerHTML='<form id="zoneForm" class="module-form"><h3>ডেলিভারি এলাকা ও চার্জ</h3><label>এলাকার নাম<input name="zone_name" required></label><label>চার্জ (৳)<input name="charge" type="number" min="0" required></label><button class="primary">এলাকা যোগ</button><p id="zoneMsg"></p></form>'+table(["এলাকা","চার্জ","অবস্থা"],data.map(x=>'<tr><td>'+esc(x.zone_name)+'</td><td>'+money(x.charge)+'</td><td>'+(x.is_active?"সক্রিয়":"বন্ধ")+'</td></tr>'))+'<p class="muted">এগুলো অ্যাডমিন সেটিংস; গ্রাহকের checkout-এ প্রয়োগের সংযোগ আলাদা কাজ। কুরিয়ার API পরে যোগ হবে।</p>';
  $("zoneForm").onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget);const {error}=await db.from("admin_app_delivery_zones").insert({zone_name:f.get("zone_name"),charge:Number(f.get("charge"))});msg("zoneMsg",error?error.message:"এলাকা যোগ হয়েছে");if(!error)delivery();};
 }
 async function payments(){
  const e=$("paymentsPanel");if(!e)return;const data=await rows("admin_app_payment_methods");
  e.innerHTML=table(["পদ্ধতি","অবস্থা","কাজ"],data.map(x=>'<tr><td>'+esc(x.display_name)+'</td><td>'+(x.is_enabled?"চালু":"বন্ধ")+'</td><td><button class="secondary payToggle" data-id="'+x.id+'" data-on="'+x.is_enabled+'">অবস্থা বদল</button></td></tr>'))+'<p class="muted">অনলাইন গেটওয়ে চালু করতে মার্চেন্ট অ্যাকাউন্ট ও API credentials লাগবে; এখানে কেবল পদ্ধতির কনফিগারেশন রাখা হচ্ছে।</p>';
  e.querySelectorAll(".payToggle").forEach(b=>b.onclick=async()=>{const {error}=await db.from("admin_app_payment_methods").update({is_enabled:b.dataset.on!=="true"}).eq("id",b.dataset.id);if(error)alert(error.message);else payments();});
 }
 async function roles(){
  const e=$("securityPanel");if(!e)return;const [staff,roleRows,perms]=await Promise.all([rows("staff_profiles","user_id,full_name,role,is_active,created_at"),rows("admin_app_staff_roles"),rows("admin_app_permissions")]);
  e.innerHTML='<form id="roleForm" class="module-form"><h3>স্টাফকে ভূমিকা দিন</h3><label>স্টাফ User ID<input name="user_id" required placeholder="Auth User UUID"></label><label>ভূমিকা<select name="role_key"><option value="manager">ম্যানেজার</option><option value="product_manager">পণ্য ব্যবস্থাপক</option><option value="order_manager">অর্ডার ব্যবস্থাপক</option><option value="inventory_manager">ইনভেন্টরি ব্যবস্থাপক</option><option value="marketing_manager">মার্কেটিং ব্যবস্থাপক</option><option value="support">কাস্টমার সাপোর্ট</option></select></label><button class="primary">ভূমিকা সংরক্ষণ</button><p id="roleMsg"></p></form>'+table(["স্টাফ","মূল ভূমিকা","বিশেষ ভূমিকা"],staff.map(s=>{const r=roleRows.find(x=>x.user_id===s.user_id);return '<tr><td>'+esc(s.full_name||s.user_id)+'</td><td>'+esc(s.role)+'</td><td>'+esc(r?.role_key||"নির্ধারিত নয়")+'</td></tr>';}))+'<h3>অনুমতি ম্যাট্রিক্স (রোলভিত্তিক)</h3>'+table(["ভূমিকা","মডিউল","দেখা","তৈরি","সম্পাদনা","মুছুন"],perms.map(p=>'<tr><td>'+esc(p.role_key)+'</td><td>'+esc(p.module_key)+'</td><td>'+(p.can_view?"হ্যাঁ":"না")+'</td><td>'+(p.can_create?"হ্যাঁ":"না")+'</td><td>'+(p.can_edit?"হ্যাঁ":"না")+'</td><td>'+(p.can_delete?"হ্যাঁ":"না")+'</td></tr>'));
  $("roleForm").onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget);const {error}=await db.from("admin_app_staff_roles").upsert({user_id:f.get("user_id").trim(),role_key:f.get("role_key"),updated_at:new Date().toISOString()});msg("roleMsg",error?error.message:"ভূমিকা সংরক্ষিত হয়েছে");if(!error)roles();};
 }
 async function audit(){
  const e=$("notificationsPanel");if(!e)return;const [n,a]=await Promise.all([rows("admin_app_notifications"),rows("admin_app_audit_logs")]);
  e.innerHTML='<form id="notifyForm" class="module-form"><h3>অ্যাডমিন নোটিফিকেশন তৈরি</h3><label>শিরোনাম<input name="title" required></label><label>বার্তা<textarea name="message" required></textarea></label><button class="primary">নোটিফিকেশন তৈরি</button><p id="notifyMsg"></p></form><h3>নোটিফিকেশন</h3>'+table(["শিরোনাম","বার্তা","তারিখ"],n.map(x=>'<tr><td>'+esc(x.title)+'</td><td>'+esc(x.message)+'</td><td>'+new Date(x.created_at).toLocaleString("bn-BD")+'</td></tr>'))+'<h3>অডিট লগ</h3>'+table(["কাজ","মডিউল","রেকর্ড","তারিখ"],a.map(x=>'<tr><td>'+esc(x.action)+'</td><td>'+esc(x.module_key)+'</td><td>'+esc(x.record_id||"—")+'</td><td>'+new Date(x.created_at).toLocaleString("bn-BD")+'</td></tr>'));
  $("notifyForm").onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget);const {error}=await db.from("admin_app_notifications").insert({title:f.get("title"),message:f.get("message")});msg("notifyMsg",error?error.message:"নোটিফিকেশন তৈরি হয়েছে");if(!error)audit();};
 }
 const funcs={settings,marketing,delivery,payments,security,notifications:audit};
 const nav=$("sideNav");if(nav&&!nav.dataset.advanced){nav.dataset.advanced="1";nav.addEventListener("click",ev=>{const b=ev.target.closest("[data-page]");if(!b)return;const fn=funcs[b.dataset.page];if(fn)setTimeout(()=>fn().catch(e=>{const id={settings:"settingsPanel",marketing:"marketingPanel",delivery:"deliveryPanel",payments:"paymentsPanel",security:"securityPanel",notifications:"notificationsPanel"}[b.dataset.page];if($(id))$(id).innerHTML='<p class="error">'+esc(e.message)+'</p>'; }),180);if(b.dataset.page==="marketing")setTimeout(()=>{const h=$("marketingPanel");if(h&&!h.querySelector("#bannerForm"))banners().catch(()=>{});},700);});}
})();


/* Full product editor and hierarchical category manager. */
(() => {
 const C=window.IMSHOP_CONFIG||{};if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY),$=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 async function productEditor(){
  const e=$("productsList");if(!e)return;
  const [p,c]=await Promise.all([db.from("products").select("id,name,description,sku,category_id,price,stock_quantity,is_active").order("created_at",{ascending:false}).limit(200),db.from("categories").select("id,name").eq("is_active",true).order("sort_order")]);
  if(p.error||c.error){e.innerHTML='<p class="error">'+esc((p.error||c.error).message)+'</p>';return;}
  e.innerHTML='<div class="table-wrap"><table><thead><tr><th>নাম ও বিবরণ</th><th>ক্যাটাগরি</th><th>দাম</th><th>স্টক</th><th>SKU</th><th>অবস্থা</th><th>কাজ</th></tr></thead><tbody>'+ (p.data||[]).map(x=>'<tr data-id="'+x.id+'"><td><input class="pn" value="'+esc(x.name)+'" aria-label="পণ্যের নাম"><textarea class="pd" rows="2" aria-label="বিবরণ">'+esc(x.description||"")+'</textarea></td><td><select class="pc"><option value="">নেই</option>'+(c.data||[]).map(k=>'<option value="'+k.id+'" '+(k.id===x.category_id?"selected":"")+'>'+esc(k.name)+'</option>').join("")+'</select></td><td><input class="pp" type="number" min="0" step="0.01" value="'+Number(x.price||0)+'"></td><td><input class="ps" type="number" min="0" step="1" value="'+Number(x.stock_quantity||0)+'"></td><td><input class="pk" value="'+esc(x.sku||"")+'"></td><td>'+(x.is_active?"সক্রিয়":"বন্ধ")+'</td><td><button class="secondary pSave">সংরক্ষণ</button> <button class="secondary pToggle" data-on="'+x.is_active+'">'+(x.is_active?"বন্ধ":"চালু")+'</button></td></tr>').join("")+'</tbody></table></div>';
  e.querySelectorAll(".pSave").forEach(b=>b.onclick=async()=>{const tr=b.closest("tr"),num=Number(tr.querySelector(".pp").value),stock=Number(tr.querySelector(".ps").value);if(num<0||stock<0||!Number.isInteger(stock)){alert("দাম/স্টক সঠিক নয়");return;}const payload={name:tr.querySelector(".pn").value.trim(),description:tr.querySelector(".pd").value.trim(),category_id:tr.querySelector(".pc").value||null,price:num,stock_quantity:stock,sku:tr.querySelector(".pk").value.trim()||null};if(!payload.name){alert("পণ্যের নাম লিখুন");return;}const {error}=await db.from("products").update(payload).eq("id",tr.dataset.id);alert(error?error.message:"পণ্যের সব তথ্য আপডেট হয়েছে");});
  e.querySelectorAll(".pToggle").forEach(b=>b.onclick=async()=>{const {error}=await db.from("products").update({is_active:b.dataset.on!=="true"}).eq("id",b.closest("tr").dataset.id);if(error)alert(error.message);else productEditor();});
 }
 async function categoryTree(){
  const e=$("categoriesPanel");if(!e)return;
  const {data,error}=await db.from("categories").select("id,name,parent_id,is_active,sort_order").order("sort_order");
  if(error){e.innerHTML='<p class="error">'+esc(error.message)+'</p>';return;}
  e.innerHTML='<form id="hierCat" class="module-form"><h3>ক্যাটাগরি / সাব-ক্যাটাগরি যোগ</h3><label>নাম<input name="name" required></label><label>মূল ক্যাটাগরি (খালি রাখলে প্রধান ক্যাটাগরি)<select name="parent_id"><option value="">প্রধান ক্যাটাগরি</option>'+(data||[]).filter(x=>!x.parent_id).map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></label><button class="primary">সংরক্ষণ</button><p id="hierCatMsg"></p></form><div class="table-wrap"><table><thead><tr><th>ক্যাটাগরি</th><th>ধরন</th><th>অবস্থা</th></tr></thead><tbody>'+(data||[]).map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+(x.parent_id?"সাব-ক্যাটাগরি":"প্রধান ক্যাটাগরি")+'</td><td>'+(x.is_active?"সক্রিয়":"বন্ধ")+'</td></tr>').join("")+'</tbody></table></div>';
  $("hierCat").onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget);const {error}=await db.from("categories").insert({name:f.get("name").trim(),parent_id:f.get("parent_id")||null,is_active:true,sort_order:(data||[]).length+1});$("hierCatMsg").textContent=error?error.message:"ক্যাটাগরি যোগ হয়েছে";if(!error)categoryTree();};
 }
 const nav=$("sideNav");if(nav&&!nav.dataset.fullEditors){nav.dataset.fullEditors="1";nav.addEventListener("click",ev=>{const b=ev.target.closest("[data-page]");if(!b)return;if(b.dataset.page==="products")setTimeout(()=>productEditor().catch(e=>{if($("productsList"))$("productsList").textContent=e.message;}),220);if(b.dataset.page==="categories")setTimeout(()=>categoryTree().catch(e=>{if($("categoriesPanel"))$("categoriesPanel").textContent=e.message;}),220);});}
})();


/* Category module v2: create, edit, activate/deactivate, and safe delete. */
(() => {
 const C=window.IMSHOP_CONFIG||{};
 if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 async function renderCategories(){
  const el=$("categoriesPanel");if(!el)return;
  el.innerHTML='<p class="muted pad">ক্যাটাগরি লোড হচ্ছে…</p>';
  const {data,error}=await db.from("categories").select("id,name,parent_id,is_active,sort_order").order("sort_order").order("name");
  if(error){el.innerHTML='<p class="error pad">ক্যাটাগরি লোড হয়নি: '+esc(error.message)+'</p>';return;}
  const rows=data||[];
  el.innerHTML='<form id="catV2Form" class="module-form"><h3>নতুন ক্যাটাগরি / সাব-ক্যাটাগরি</h3><label>নাম<input name="name" maxlength="100" required placeholder="যেমন: পাঞ্জাবি"></label><label>মূল ক্যাটাগরি<select name="parent_id"><option value="">প্রধান ক্যাটাগরি</option>'+rows.filter(x=>!x.parent_id).map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></label><button class="primary" type="submit">ক্যাটাগরি যোগ করুন</button><p id="catV2Msg" class="message" aria-live="polite"></p></form><h3>ক্যাটাগরি তালিকা</h3><div class="table-wrap"><table><thead><tr><th>নাম</th><th>ধরন</th><th>অবস্থা</th><th>কাজ</th></tr></thead><tbody>'+rows.map(x=>'<tr data-id="'+x.id+'"><td><input class="cat-v2-name" value="'+esc(x.name)+'" maxlength="100" aria-label="ক্যাটাগরির নাম"></td><td>'+(x.parent_id?'সাব-ক্যাটাগরি':'প্রধান ক্যাটাগরি')+'</td><td>'+(x.is_active?'সক্রিয়':'বন্ধ')+'</td><td><button type="button" class="secondary cat-v2-save">নাম সংরক্ষণ</button> <button type="button" class="secondary cat-v2-toggle" data-active="'+x.is_active+'">'+(x.is_active?'বন্ধ':'চালু')+'</button> <button type="button" class="secondary cat-v2-delete">মুছুন</button></td></tr>').join("")+'</tbody></table></div>';
  $("catV2Form").onsubmit=async ev=>{
   ev.preventDefault();const f=new FormData(ev.currentTarget),name=String(f.get("name")||"").trim();
   if(!name)return;
   const {error}=await db.from("categories").insert({name,parent_id:f.get("parent_id")||null,is_active:true,sort_order:rows.length+1});
   const m=$("catV2Msg");m.textContent=error?"সংরক্ষণ হয়নি: "+error.message:"ক্যাটাগরি যোগ হয়েছে।";m.className="message "+(error?"error":"success");
   if(!error)renderCategories();
  };
  el.querySelectorAll(".cat-v2-save").forEach(b=>b.onclick=async()=>{
   const tr=b.closest("tr"),name=tr.querySelector(".cat-v2-name").value.trim();
   if(!name){alert("ক্যাটাগরির নাম লিখুন।");return;}
   b.disabled=true;const {error}=await db.from("categories").update({name}).eq("id",tr.dataset.id);
   if(error)alert("নাম পরিবর্তন হয়নি: "+error.message);else renderCategories();b.disabled=false;
  });
  el.querySelectorAll(".cat-v2-toggle").forEach(b=>b.onclick=async()=>{
   b.disabled=true;const {error}=await db.from("categories").update({is_active:b.dataset.active!=="true"}).eq("id",b.closest("tr").dataset.id);
   if(error)alert("অবস্থা বদল হয়নি: "+error.message);else renderCategories();b.disabled=false;
  });
  el.querySelectorAll(".cat-v2-delete").forEach(b=>b.onclick=async()=>{
   const id=b.closest("tr").dataset.id;
   const [p,ch]=await Promise.all([
    db.from("products").select("id",{count:"exact",head:true}).eq("category_id",id),
    db.from("categories").select("id",{count:"exact",head:true}).eq("parent_id",id)
   ]);
   if(p.error||ch.error){alert("মুছতে যাচাই করা যায়নি: "+(p.error||ch.error).message);return;}
   if((p.count||0)>0||(ch.count||0)>0){alert("এই ক্যাটাগরির অধীনে পণ্য বা সাব-ক্যাটাগরি আছে। আগে সেগুলো অন্য ক্যাটাগরিতে সরান।");return;}
   if(!confirm("এই ক্যাটাগরি স্থায়ীভাবে মুছবেন?"))return;
   b.disabled=true;const {error}=await db.from("categories").delete().eq("id",id);
   if(error)alert("মুছতে সমস্যা: "+error.message);else renderCategories();b.disabled=false;
  });
 }
 document.getElementById("sideNav")?.addEventListener("click",ev=>{
  if(ev.target.closest('[data-page="categories"]'))setTimeout(()=>renderCategories().catch(e=>{const el=$("categoriesPanel");if(el)el.textContent=e.message;}),500);
 });
})();


/* Inventory module v2: stock adjustment, low-stock watch, and movement history. */
(() => {
 const C=window.IMSHOP_CONFIG||{};
 if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 async function renderInventory(){
  const el=$("inventoryPanel");if(!el)return;
  el.innerHTML='<p class="muted pad">স্টক তথ্য লোড হচ্ছে…</p>';
  const [p,m]=await Promise.all([
   db.from("products").select("id,name,sku,stock_quantity,is_active").order("name").limit(500),
   db.from("admin_app_stock_movements").select("id,product_id,quantity_before,quantity_after,change_amount,reason,note,created_at").order("created_at",{ascending:false}).limit(100)
  ]);
  if(p.error){el.innerHTML='<p class="error pad">পণ্যের স্টক লোড হয়নি: '+esc(p.error.message)+'</p>';return;}
  const products=p.data||[], movements=m.error?[]:(m.data||[]), names=Object.fromEntries(products.map(x=>[x.id,x.name]));
  const low=products.filter(x=>Number(x.stock_quantity||0)<=5);
  el.innerHTML='<div class="module-kpis"><article><b>'+products.length+'</b><span>মোট পণ্য</span></article><article><b>'+low.length+'</b><span>কম স্টক (৫ বা কম)</span></article><article><b>'+products.filter(x=>Number(x.stock_quantity||0)===0).length+'</b><span>স্টক শেষ</span></article></div><h3>স্টক আপডেট</h3><div class="table-wrap"><table><thead><tr><th>পণ্য</th><th>SKU</th><th>বর্তমান স্টক</th><th>নতুন স্টক</th><th>কাজ</th></tr></thead><tbody>'+products.map(x=>'<tr data-id="'+x.id+'"><td>'+esc(x.name)+'</td><td>'+esc(x.sku||"—")+'</td><td>'+Number(x.stock_quantity||0)+'</td><td><input class="inv-v2-qty" type="number" min="0" step="1" value="'+Number(x.stock_quantity||0)+'" aria-label="নতুন স্টক"></td><td><button class="secondary inv-v2-save">স্টক সংরক্ষণ</button></td></tr>').join("")+'</tbody></table></div><h3>কম স্টকের পণ্য</h3>'+ (low.length?'<ul>'+low.map(x=>'<li>'+esc(x.name)+' — '+Number(x.stock_quantity||0)+' টি</li>').join("")+'</ul>':'<p class="muted">এখন কোনো পণ্যের স্টক কম নেই।')+'</p><h3>সর্বশেষ স্টক পরিবর্তনের ইতিহাস</h3>'+(m.error?'<p class="error">ইতিহাসের টেবিল পাওয়া যায়নি: '+esc(m.error.message)+'</p>':(movements.length?'<div class="table-wrap"><table><thead><tr><th>পণ্য</th><th>আগের স্টক</th><th>পরের স্টক</th><th>পরিবর্তন</th><th>কারণ</th><th>সময়</th></tr></thead><tbody>'+movements.map(x=>'<tr><td>'+esc(names[x.product_id]||"পণ্য আর তালিকায় নেই")+'</td><td>'+x.quantity_before+'</td><td>'+x.quantity_after+'</td><td>'+(x.change_amount>0?"+":"")+x.change_amount+'</td><td>'+esc(x.reason||"manual_adjustment")+(x.note?" — "+esc(x.note):"")+'</td><td>'+new Date(x.created_at).toLocaleString("bn-BD")+'</td></tr>').join("")+'</tbody></table></div>':'<p class="muted">এখনো স্টক পরিবর্তনের ইতিহাস নেই।</p>'));
  el.querySelectorAll(".inv-v2-save").forEach(b=>b.onclick=async()=>{
   const tr=b.closest("tr"),qty=Number(tr.querySelector(".inv-v2-qty").value);
   if(!Number.isInteger(qty)||qty<0){alert("স্টক শূন্য বা তার বেশি পূর্ণসংখ্যা হতে হবে।");return;}
   b.disabled=true;
   const {error}=await db.from("products").update({stock_quantity:qty}).eq("id",tr.dataset.id);
   if(error)alert("স্টক সংরক্ষণ হয়নি: "+error.message);else renderInventory();
   b.disabled=false;
  });
 }
 document.getElementById("sideNav")?.addEventListener("click",ev=>{
  if(ev.target.closest('[data-page="inventory"]'))setTimeout(()=>renderInventory().catch(e=>{const el=$("inventoryPanel");if(el)el.textContent=e.message;}),500);
 });
})();


/* Product module v2: image replacement, featured flag, complete field edit, and safe archive/delete. */
(() => {
 const C=window.IMSHOP_CONFIG||{};
 if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const money=v=>"৳"+Number(v||0).toLocaleString("en-BD");
 async function renderProducts(){
  const el=$("productsList");if(!el)return;
  el.innerHTML='<p class="muted pad">পণ্য লোড হচ্ছে…</p>';
  const [p,c]=await Promise.all([
   db.from("products").select("id,name,description,sku,category_id,price,stock_quantity,is_active,is_featured,image_url,created_at").order("created_at",{ascending:false}).limit(300),
   db.from("categories").select("id,name").eq("is_active",true).order("sort_order")
  ]);
  if(p.error||c.error){el.innerHTML='<p class="error pad">'+esc((p.error||c.error).message)+'</p>';return;}
  const products=p.data||[],cats=c.data||[];
  el.innerHTML='<div class="module-kpis"><article><b>'+products.length+'</b><span>মোট পণ্য</span></article><article><b>'+products.filter(x=>x.is_active).length+'</b><span>সক্রিয় পণ্য</span></article><article><b>'+products.filter(x=>Number(x.stock_quantity||0)<=5).length+'</b><span>কম স্টক</span></article></div><label>পণ্য খুঁজুন<input id="productV2Search" placeholder="নাম বা SKU লিখুন"></label><div class="table-wrap"><table><thead><tr><th>ছবি ও পণ্যের তথ্য</th><th>ক্যাটাগরি</th><th>দাম / স্টক</th><th>ফিচার</th><th>অবস্থা / কাজ</th></tr></thead><tbody>'+products.map(x=>'<tr data-id="'+x.id+'"><td>'+(x.image_url?'<img src="'+esc(x.image_url)+'" alt="" style="width:52px;height:52px;object-fit:cover;border-radius:8px">':'')+'<input class="pv2-name" value="'+esc(x.name)+'" aria-label="পণ্যের নাম"><textarea class="pv2-desc" rows="2" aria-label="বিবরণ">'+esc(x.description||"")+'</textarea><input class="pv2-sku" value="'+esc(x.sku||"")+'" placeholder="SKU"></td><td><select class="pv2-cat"><option value="">ক্যাটাগরি নেই</option>'+cats.map(k=>'<option value="'+k.id+'" '+(k.id===x.category_id?"selected":"")+'>'+esc(k.name)+'</option>').join("")+'</select></td><td><input class="pv2-price" type="number" min="0" step="0.01" value="'+Number(x.price||0)+'" aria-label="দাম"><input class="pv2-stock" type="number" min="0" step="1" value="'+Number(x.stock_quantity||0)+'" aria-label="স্টক"></td><td><label><input class="pv2-featured" type="checkbox" '+(x.is_featured?"checked":"")+'> ফিচার্ড</label><label class="pv2-image-label">নতুন ছবি<input class="pv2-image" type="file" accept="image/jpeg,image/png,image/webp"></label></td><td>'+(x.is_active?'সক্রিয়':'বন্ধ')+'<br><button type="button" class="secondary pv2-save">সব সংরক্ষণ</button> <button type="button" class="secondary pv2-toggle" data-active="'+x.is_active+'">'+(x.is_active?'বন্ধ':'চালু')+'</button> <button type="button" class="secondary pv2-delete">মুছুন</button></td></tr>').join("")+'</tbody></table></div>';
  $("productV2Search").oninput=ev=>{const q=ev.target.value.toLowerCase();el.querySelectorAll("tbody tr").forEach(tr=>tr.hidden=!tr.innerText.toLowerCase().includes(q));};
  el.querySelectorAll(".pv2-save").forEach(b=>b.onclick=async()=>{
   const tr=b.closest("tr"),price=Number(tr.querySelector(".pv2-price").value),stock=Number(tr.querySelector(".pv2-stock").value),name=tr.querySelector(".pv2-name").value.trim(),file=tr.querySelector(".pv2-image").files[0];
   if(!name||!Number.isFinite(price)||price<0||!Number.isInteger(stock)||stock<0){alert("নাম, দাম ও স্টক সঠিকভাবে দিন।");return;}
   b.disabled=true;let image_url;
   try{
    if(file){
     if(file.size>5*1024*1024)throw new Error("ছবির সাইজ ৫ MB-এর বেশি হতে পারবে না।");
     if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("শুধু JPG, PNG বা WebP ছবি দিন।");
     const ext=file.name.split(".").pop().toLowerCase(),path="products/"+crypto.randomUUID()+"."+ext;
     const {error:up}=await db.storage.from("products").upload(path,file,{contentType:file.type,upsert:false});if(up)throw up;
     image_url=db.storage.from("products").getPublicUrl(path).data.publicUrl;
    }
    const payload={name,description:tr.querySelector(".pv2-desc").value.trim(),sku:tr.querySelector(".pv2-sku").value.trim()||null,category_id:tr.querySelector(".pv2-cat").value||null,price,stock_quantity:stock,is_featured:tr.querySelector(".pv2-featured").checked};
    if(image_url)payload.image_url=image_url;
    const {error}=await db.from("products").update(payload).eq("id",tr.dataset.id);if(error)throw error;
    renderProducts();
   }catch(e){alert("পণ্য সংরক্ষণ হয়নি: "+e.message);b.disabled=false;}
  });
  el.querySelectorAll(".pv2-toggle").forEach(b=>b.onclick=async()=>{
   b.disabled=true;const {error}=await db.from("products").update({is_active:b.dataset.active!=="true"}).eq("id",b.closest("tr").dataset.id);
   if(error)alert(error.message);else renderProducts();b.disabled=false;
  });
  el.querySelectorAll(".pv2-delete").forEach(b=>b.onclick=async()=>{
   const id=b.closest("tr").dataset.id;
   const {count,error}=await db.from("order_items").select("id",{count:"exact",head:true}).eq("product_id",id);
   if(error){alert("অর্ডার-সংযোগ যাচাই করা যায়নি: "+error.message);return;}
   if((count||0)>0){
    if(!confirm("এই পণ্য পুরোনো অর্ডারে আছে। স্থায়ীভাবে মুছলে অর্ডারের তথ্য নষ্ট হতে পারে। পণ্যটি শুধু বন্ধ করবেন?"))return;
    const {error:e}=await db.from("products").update({is_active:false}).eq("id",id);if(e)alert(e.message);else renderProducts();return;
   }
   if(!confirm("এই পণ্য স্থায়ীভাবে মুছবেন?"))return;
   b.disabled=true;const {error:e}=await db.from("products").delete().eq("id",id);
   if(e)alert("পণ্য মুছতে সমস্যা: "+e.message);else renderProducts();b.disabled=false;
  });
 }
 document.getElementById("sideNav")?.addEventListener("click",ev=>{
  if(ev.target.closest('[data-page="products"]'))setTimeout(()=>renderProducts().catch(e=>{const el=$("productsList");if(el)el.textContent=e.message;}),550);
 });
})();


/* Customer and sales-report tools: search, date filters, and CSV exports. */
(() => {
 const C=window.IMSHOP_CONFIG||{};
 if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const money=v=>"৳"+Number(v||0).toLocaleString("en-BD");
 function csv(name,rows){
  const body=rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
  const blob=new Blob(["\uFEFF"+body],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
 }
 async function customers(){
  const el=$("customersPanel");if(!el)return;
  el.innerHTML='<p class="muted">ক্রেতার তথ্য লোড হচ্ছে…</p>';
  const {data,error}=await db.from("customers").select("*").order("created_at",{ascending:false}).limit(1000);
  if(error){el.innerHTML='<p class="error">'+esc(error.message)+'</p>';return;}
  const rows=data||[];
  const norm=c=>({name:c.full_name||c.name||c.customer_name||"",phone:c.phone||c.mobile||c.phone_number||"",email:c.email||"",date:c.created_at||"",id:c.id||""});
  const normalized=rows.map(norm);
  el.innerHTML='<div class="module-kpis"><article><b>'+rows.length+'</b><span>সর্বশেষ ১০০০ ক্রেতা</span></article></div><div class="toolbar"><label>ক্রেতা খুঁজুন<input id="customerV2Search" placeholder="নাম, মোবাইল বা ইমেইল"></label><button id="customerV2Export" class="secondary" type="button">CSV ডাউনলোড</button></div><div class="table-wrap"><table><thead><tr><th>নাম</th><th>ইমেইল</th><th>যোগদানের তারিখ</th></tr></thead><tbody>'+normalized.map(c=>'<tr><td>'+esc(c.name||"—")+'</td><td>'+esc(c.phone||"—")+'</td><td>'+esc(c.email||"—")+'</td><td>'+esc(c.date?new Date(c.date).toLocaleDateString("bn-BD"):"—")+'</td></tr>').join("")+'</tbody></table></div>';
  $("customerV2Search").oninput=e=>{const q=e.target.value.toLowerCase();el.querySelectorAll("tbody tr").forEach(tr=>tr.hidden=!tr.innerText.toLowerCase().includes(q));};
  $("customerV2Export").onclick=()=>csv("im-shop-customers.csv",[["Name","Phone","Email","Created"],...normalized.map(c=>[c.name,c.phone,c.email,c.date])]);
 }
 async function reports(){
  const el=$("reportsPanel");if(!el)return;
  el.innerHTML='<p class="muted">বিক্রয় রিপোর্ট তৈরি হচ্ছে…</p>';
  const {data,error}=await db.from("orders").select("id,order_number,customer_name,total,status,created_at").order("created_at",{ascending:false}).limit(2000);
  if(error){el.innerHTML='<p class="error">'+esc(error.message)+'</p>';return;}
  const rows=data||[];
  el.innerHTML='<div class="toolbar"><label>শুরুর তারিখ<input id="reportV2From" type="date"></label><label>শেষ তারিখ<input id="reportV2To" type="date"></label><button id="reportV2Apply" class="secondary" type="button">রিপোর্ট দেখুন</button><button id="reportV2Export" class="secondary" type="button">CSV ডাউনলোড</button></div><div id="reportV2Summary"></div><div class="table-wrap" id="reportV2Table"></div>';
  function draw(){
   const from=$("reportV2From").value,to=$("reportV2To").value;
   const filtered=rows.filter(x=>(!from||String(x.created_at).slice(0,10)>=from)&&(!to||String(x.created_at).slice(0,10)<=to));
   const paid=filtered.filter(x=>!["cancelled","failed"].includes(String(x.status).toLowerCase()));
   const total=paid.reduce((s,x)=>s+Number(x.total||0),0);
   $("reportV2Summary").innerHTML='<div class="module-kpis"><article><b>'+filtered.length+'</b><span>মোট অর্ডার</span></article><article><b>'+paid.length+'</b><span>বাতিল/ব্যর্থ বাদে</span></article><article><b>'+money(total)+'</b><span>অর্ডার মূল্য (প্রাপ্ত অর্থ নয়)</span></article></div>';
   $("reportV2Table").innerHTML='<table><thead><tr><th>তারিখ</th><th>অর্ডার</th><th>ক্রেতা</th><th>মোট</th><th>স্ট্যাটাস</th></tr></thead><tbody>'+filtered.slice(0,500).map(x=>'<tr><td>'+new Date(x.created_at).toLocaleDateString("bn-BD")+'</td><td>'+esc(x.order_number||x.id)+'</td><td>'+esc(x.customer_name||"—")+'</td><td>'+money(x.total)+'</td><td>'+esc(x.status)+'</td></tr>').join("")+'</tbody></table>';
   $("reportV2Export").onclick=()=>csv("im-shop-sales-report.csv",[["Date","Order","Customer","Total","Status"],...filtered.map(x=>[x.created_at,x.order_number||x.id,x.customer_name,x.total,x.status])]);
  }
  $("reportV2Apply").onclick=draw;draw();
 }
 document.getElementById("sideNav")?.addEventListener("click",ev=>{
  const b=ev.target.closest("[data-page]");if(!b)return;
  if(b.dataset.page==="customers")setTimeout(()=>customers().catch(e=>{const el=$("customersPanel");if(el)el.textContent=e.message;}),650);
  if(b.dataset.page==="reports")setTimeout(()=>reports().catch(e=>{const el=$("reportsPanel");if(el)el.textContent=e.message;}),650);
 });
})();


/* Order desk: client-side search/filter and export without changing order records. */
(() => {
 const C=window.IMSHOP_CONFIG||{};
 if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const money=v=>"৳"+Number(v||0).toLocaleString("en-BD");
 let rows=[];
 async function load(){
  const el=$("ordersList");if(!el)return;
  const {data,error}=await db.from("orders").select("id,order_number,customer_name,total,status,created_at").order("created_at",{ascending:false}).limit(1000);
  if(error){el.innerHTML='<p class="error">'+esc(error.message)+'</p>';return;}
  rows=data||[];
  el.innerHTML='<div class="toolbar"><label>অর্ডার খুঁজুন<input id="orderDeskSearch" placeholder="অর্ডার নম্বর, ক্রেতা বা মোবাইল"></label><label>স্ট্যাটাস<select id="orderDeskStatus"><option value="">সব স্ট্যাটাস</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="processing">Processing</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select></label><button id="orderDeskExport" class="secondary" type="button">CSV ডাউনলোড</button></div><div id="orderDeskSummary" class="module-kpis"></div><div id="orderDeskRows" class="table-wrap"></div>';
  function draw(){
   const q=$("orderDeskSearch").value.toLowerCase(),st=$("orderDeskStatus").value;
   const filtered=rows.filter(x=>(!st||x.status===st)&&[x.order_number,x.customer_name].some(v=>String(v||"").toLowerCase().includes(q)));
   $("orderDeskSummary").innerHTML='<article><b>'+filtered.length+'</b><span>মিল পাওয়া অর্ডার</span></article><article><b>'+money(filtered.filter(x=>x.status!=="cancelled").reduce((s,x)=>s+Number(x.total||0),0))+'</b><span>বাতিল বাদে অর্ডার মূল্য</span></article>';
   $("orderDeskRows").innerHTML='<table><thead><tr><th>অর্ডার</th><th>ক্রেতা</th><th>মোবাইল</th><th>মোট</th><th>স্ট্যাটাস / পরিবর্তন</th><th>তারিখ</th></tr></thead><tbody>'+filtered.map(x=>'<tr><td>'+esc(x.order_number||x.id)+'</td><td>'+esc(x.customer_name||"—")+'</td><td>'+esc(x.customer_phone||"—")+'</td><td>'+money(x.total)+'</td><td>'+esc(x.status)+'</td><td>'+esc(x.created_at?new Date(x.created_at).toLocaleString("bn-BD"):"—")+'</td></tr>').join("")+'</tbody></table>';
   $("orderDeskExport").onclick=()=>{const lines=[["Order","Customer","Phone","Total","Status","Created"],...filtered.map(x=>[x.order_number||x.id,x.customer_name,x.customer_phone,x.total,x.status,x.created_at])];const csv=lines.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");const u=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=u;a.download="im-shop-orders.csv";a.click();URL.revokeObjectURL(u);};
  }
  $("orderDeskSearch").oninput=draw;$("orderDeskStatus").onchange=draw;draw();
  $("orderDeskRows").addEventListener("change",async ev=>{const sel=ev.target.closest(".orderDeskStatusEdit");if(!sel)return;sel.disabled=true;const {error}=await db.rpc("admin_update_order_status",{p_order_id:sel.dataset.id,p_status:sel.value});if(error){alert("স্ট্যাটাস পরিবর্তন হয়নি: "+error.message);sel.disabled=false;}else{const found=rows.find(x=>x.id===sel.dataset.id);if(found)found.status=sel.value;draw();}});
 }
 document.getElementById("sideNav")?.addEventListener("click",e=>{const b=e.target.closest('[data-page="orders"]');if(b)setTimeout(()=>load().catch(err=>{const el=$("ordersList");if(el)el.textContent=err.message;}),700);});
})();


/* Security workspace v2: assign a role to an existing active staff member and edit role permissions. */
(() => {
 const C=window.IMSHOP_CONFIG||{};if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY),$=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 async function render(){
  const el=$("securityPanel");if(!el)return;
  el.innerHTML='<p>নিরাপত্তা ও অনুমতি লোড হচ্ছে…</p>';
  const [s,r,p]=await Promise.all([
   db.from("staff_profiles").select("user_id,full_name,role,is_active").order("created_at",{ascending:false}),
   db.from("admin_app_staff_roles").select("*"),
   db.from("admin_app_permissions").select("*").order("role_key").order("module_key")
  ]);
  const err=s.error||r.error||p.error;
  if(err){el.innerHTML='<p class="error">ডেটা লোড হয়নি: '+esc(err.message)+'</p>';return;}
  const staff=(s.data||[]).filter(x=>x.is_active&&x.role!=="admin");
  el.innerHTML='<h3>স্টাফের ভূমিকা নির্ধারণ</h3><form id="secRoleForm" class="module-form"><label>সক্রিয় স্টাফ<select name="user_id" required><option value="">স্টাফ নির্বাচন করুন</option>'+staff.map(x=>'<option value="'+esc(x.user_id)+'">'+esc(x.full_name||x.user_id)+' · '+esc(x.user_id)+'</option>').join("")+'</select></label><label>কাজের ভূমিকা<select name="role_key"><option value="manager">ম্যানেজার</option><option value="product_manager">পণ্য ব্যবস্থাপক</option><option value="order_manager">অর্ডার ব্যবস্থাপক</option><option value="inventory_manager">ইনভেন্টরি ব্যবস্থাপক</option><option value="marketing_manager">মার্কেটিং ব্যবস্থাপক</option><option value="support">কাস্টমার সাপোর্ট</option></select></label><button class="primary">ভূমিকা সংরক্ষণ</button><p id="secRoleMsg" aria-live="polite"></p></form><h3>বর্তমান স্টাফ ভূমিকা</h3><div class="table-wrap"><table><thead><tr><th>স্টাফ</th><th>মূল ভূমিকা</th><th>বিশেষ ভূমিকা</th></tr></thead><tbody>'+staff.map(x=>{const z=(r.data||[]).find(y=>y.user_id===x.user_id);return '<tr><td>'+esc(x.full_name||x.user_id)+'</td><td>'+esc(x.role)+'</td><td>'+esc(z?.role_key||"নির্ধারিত নয়")+'</td></tr>';}).join("")+'</tbody></table></div><h3>রোলভিত্তিক অনুমতি</h3><p class="muted">প্রতিটি রোল ও মডিউলের দেখা, তৈরি, সম্পাদনা ও মুছার অনুমতি আলাদাভাবে সংরক্ষণ করুন।</p><div class="table-wrap"><table><thead><tr><th>রোল</th><th>মডিউল</th><th>দেখা</th><th>তৈরি</th><th>সম্পাদনা</th><th>মুছুন</th><th>সংরক্ষণ</th></tr></thead><tbody>'+ (p.data||[]).map((x,i)=>'<tr data-perm="'+i+'"><td>'+esc(x.role_key)+'</td><td>'+esc(x.module_key)+'</td>'+["can_view","can_create","can_edit","can_delete"].map(k=>'<td><input type="checkbox" data-field="'+k+'" '+(x[k]?'checked':'')+' aria-label="'+k+'"></td>').join("")+'<td><button class="secondary secPermSave" type="button">সংরক্ষণ</button></td></tr>').join("")+'</tbody></table></div><p id="secPermMsg" aria-live="polite"></p><h3>নিরাপত্তা অবস্থা</h3><p>অ্যাডমিন লগইন Supabase Auth দিয়ে যাচাই হয়। OTP/MFA সক্রিয় আছে—এমন দাবি করা হচ্ছে না; Supabase Auth-এ আলাদাভাবে যাচাই ও কনফিগার করতে হবে।';
  $("secRoleForm").onsubmit=async ev=>{ev.preventDefault();const fd=new FormData(ev.currentTarget),uid=fd.get("user_id"),role=fd.get("role_key");if(!uid)return;const {error}=await db.from("admin_app_staff_roles").upsert({user_id:uid,role_key:role,updated_at:new Date().toISOString()},{onConflict:"user_id"});$("secRoleMsg").textContent=error?"সংরক্ষণ হয়নি: "+error.message:"স্টাফের ভূমিকা সংরক্ষিত হয়েছে।";if(!error)setTimeout(render,500);};
  el.querySelectorAll(".secPermSave").forEach(btn=>btn.onclick=async()=>{const tr=btn.closest("tr"),idx=Number(tr.dataset.perm),row=p.data[idx],patch={};tr.querySelectorAll("[data-field]").forEach(ch=>patch[ch.dataset.field]=ch.checked);btn.disabled=true;const {error}=await db.from("admin_app_permissions").update(patch).eq("role_key",row.role_key).eq("module_key",row.module_key);btn.disabled=false;$("secPermMsg").textContent=error?"অনুমতি সংরক্ষণ হয়নি: "+error.message:"অনুমতি আপডেট হয়েছে।";});
 }
 document.getElementById("sideNav")?.addEventListener("click",e=>{const b=e.target.closest('[data-page="security"]');if(b)setTimeout(()=>render().catch(err=>{const el=$("securityPanel");if(el)el.textContent=err.message;}),1100);});
})();
