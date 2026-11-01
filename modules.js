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
