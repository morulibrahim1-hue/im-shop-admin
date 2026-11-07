(() => {
  const cfg = window.IMSHOP_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const statusNames = {pending:"পেন্ডিং", confirmed:"কনফার্ম", processing:"প্রসেসিং", shipped:"পাঠানো হয়েছে", delivered:"ডেলিভারি সম্পন্ন", cancelled:"বাতিল"};
  let db = null;
  let currentUser = null;
  let currentRole = "admin";
  let rolePermissions = {};
  let toastTimer;

  function message(id, text, bad=false) {
    const el = $(id); if (!el) return;
    el.textContent = text; el.className = "message " + (bad ? "error" : "success");
  }
  function toast(text) {
    const el = $("toast"); el.textContent = text; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  }
  function money(v) { return "৳" + Number(v || 0).toLocaleString("en-BD"); }
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  async function showApp(user, profile=null) {
    currentUser = user;
    currentRole = profile?.role || "admin";
    rolePermissions = {};
    if (currentRole !== "admin") {
      const {data,error}=await db.from("admin_app_permissions").select("module_key,can_view,can_create,can_edit,can_delete").eq("role_key",currentRole);
      if(error) throw error;
      rolePermissions=Object.fromEntries((data||[]).map(x=>[x.module_key,x]));
    }
    $("loginView").classList.add("hidden"); $("appView").classList.remove("hidden");
    $("adminEmail").textContent = user.email || currentRole;
    document.querySelectorAll(".nav-item").forEach(b => {
      const page=b.dataset.page, module=page==="addProduct"?"products":page;
      const perm=rolePermissions[module];
      b.hidden = currentRole!=="admin" && (!perm?.can_view || (page==="addProduct" && !perm?.can_create));
    });
    navigate(currentRole==="admin"?"dashboard":"orders"); refreshAll();
  }
  function showLogin() { currentRole="admin";rolePermissions={};$("appView").classList.add("hidden"); $("loginView").classList.remove("hidden"); }
  async function getStaffProfile(user) {
    const { data, error } = await db.from("staff_profiles")
      .select("role,is_active").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!data || data.is_active !== true) return null;
    return data;
  }
  async function refreshAll() {
    await Promise.allSettled([loadDashboard(), loadProducts(), loadCategories(), loadOrders(), loadStaff()]);
  }
  function navigate(page) {
    if(currentRole!=="admin"){
      const module=page==="addProduct"?"products":page,perm=rolePermissions[module];
      if(!perm?.can_view || (page==="addProduct"&&!perm.can_create)){toast("এই মেনু ব্যবহারের অনুমতি নেই।");return;}
    }
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    $("page-" + page).classList.remove("hidden");
    document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.page === page));
    const titles = {dashboard:"ড্যাশবোর্ড",products:"পণ্যসমূহ",addProduct:"পণ্য যোগ করুন",orders:"অর্ডারসমূহ",staff:"স্টাফ ম্যানেজমেন্ট",settings:"সেটিংস",categories:"ক্যাটাগরি",inventory:"স্টক ও ইনভেন্টরি",customers:"কাস্টমার",reports:"বিক্রয় ও রিপোর্ট",payments:"পেমেন্ট",delivery:"ডেলিভারি",marketing:"কুপন ও প্রচার",notifications:"নোটিফিকেশন",chat:"ইউজার চ্যাট",security:"নিরাপত্তা"};
    $("pageTitle").textContent = titles[page] || "ড্যাশবোর্ড";
    window.dispatchEvent(new CustomEvent("imshop:page", {detail:{page}}));
  }
  async function loadDashboard() {
    const [p,o,r] = await Promise.all([
      db.from("products").select("id", {count:"exact", head:true}),
      db.from("orders").select("id", {count:"exact", head:true}),
      db.rpc("admin_sales_dashboard")
    ]);
    if (!p.error) $("statProducts").textContent = p.count ?? 0;
    if (!o.error) $("statOrders").textContent = o.count ?? 0;
    if (!r.error && r.data) {
      $("statPending").textContent = r.data.pending_orders ?? 0;
      $("statSales").textContent = money(r.data.total_sales);
    } else if (r.error) $("statSales").textContent = "—";
    const {data, error} = await db.from("orders").select("order_number,customer_name,total,status,created_at").order("created_at",{ascending:false}).limit(5);
    $("recentOrders").innerHTML = error ? `<p class="pad error">${escapeHtml(error.message)}</p>` : orderTable(data || [], false);
  }
  async function loadCategories() {
    const {data,error} = await db.from("categories").select("id,name").eq("is_active",true).order("sort_order");
    if (error) return;
    $("pCategory").innerHTML = '<option value="">ক্যাটাগরি নির্বাচন করুন</option>' +
      (data||[]).map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  }
  async function loadProducts() {
    const {data,error} = await db.from("products").select("id,name,price,stock_quantity,is_active,created_at").order("created_at",{ascending:false}).limit(100);
    $("productsList").innerHTML = error ? `<p class="pad error">${escapeHtml(error.message)}</p>` :
      (data?.length ? `<table><thead><tr><th>পণ্য</th><th>দাম</th><th>স্টক</th><th>অবস্থা</th></tr></thead><tbody>${data.map(x=>`<tr><td>${escapeHtml(x.name)}</td><td>${money(x.price)}</td><td>${x.stock_quantity ?? 0}</td><td>${x.is_active?"সক্রিয়":"বন্ধ"}</td></tr>`).join("")}</tbody></table>` : '<p class="pad muted">এখনো কোনো পণ্য যোগ করা হয়নি।</p>');
  }
  function orderTable(rows, full=true) {
    if (!rows.length) return '<p class="pad muted">এখনো কোনো অর্ডার নেই।</p>';
    if (!full) return '<div class="table-wrap"><table><thead><tr><th>অর্ডার নম্বর</th><th>ক্রেতা</th><th>মোট</th><th>অবস্থা</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+escapeHtml(x.order_number||"—") + '</td><td>'+escapeHtml(x.customer_name||"—") + '</td><td>'+money(x.total)+'</td><td>'+escapeHtml(statusNames[x.status]||x.status||"—")+'</td></tr>').join("")+'</tbody></table></div>';
    return '<div class="toolbar"><label>অর্ডার খুঁজুন<input id="orderSearch" type="search" placeholder="অর্ডার নম্বর বা ক্রেতার নাম"></label><label>স্ট্যাটাস বাছাই<select id="orderStatusFilter"><option value="">সব স্ট্যাটাস</option>'+Object.entries(statusNames).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join("")+'</select></label><button id="orderExport" class="secondary" type="button">CSV ডাউনলোড</button></div><div id="orderSummary" class="module-kpis"></div><div class="table-wrap"><table><thead><tr><th>অর্ডার নম্বর</th><th>ক্রেতা</th><th>মোট</th><th>বর্তমান অবস্থা</th><th>স্ট্যাটাস পরিবর্তন</th><th>তারিখ</th><th>বিস্তারিত</th></tr></thead><tbody id="orderRows"></tbody></table></div>';
  }
  async function loadOrders() {
    const box = $("ordersList");
    if (!box) return;
    box.innerHTML = '<p class="pad muted">অর্ডার লোড হচ্ছে…</p>';
    const {data,error} = await db.from("orders")
      .select("id,order_number,customer_name,total,status,created_at")
      .order("created_at",{ascending:false}).limit(1000);
    if (error) {
      box.innerHTML = '<p class="pad error">অর্ডার লোড হয়নি: ' + escapeHtml(error.message) + '</p>';
      return;
    }
    const rows = data || [];
    if (!rows.length) {
      box.innerHTML = '<p class="pad muted">এখনো কোনো অর্ডার নেই।</p>';
      return;
    }
    box.innerHTML = orderTable(rows);
    const search = $("orderSearch"), filter = $("orderStatusFilter");
    const body = $("orderRows"), summary = $("orderSummary");
    function draw() {
      const q = search.value.trim().toLocaleLowerCase();
      const st = filter.value;
      const filtered = rows.filter(x =>
        (!st || x.status === st) &&
        [x.order_number,x.customer_name].some(v => String(v || "").toLocaleLowerCase().includes(q))
      );
      summary.innerHTML = '<article><b>'+filtered.length+'</b><span>দেখানো অর্ডার</span></article><article><b>'+money(filtered.filter(x=>!["cancelled","failed"].includes(String(x.status||"").toLowerCase())).reduce((n,x)=>n+Number(x.total||0),0))+'</b><span>বাতিল বাদে অর্ডার মূল্য</span></article>';
      body.innerHTML = filtered.map(x => '<tr><td>'+escapeHtml(x.order_number||x.id)+'</td><td>'+escapeHtml(x.customer_name||"—")+'</td><td>'+money(x.total)+'</td><td><span class="status">'+escapeHtml(statusNames[x.status]||x.status||"—")+'</span></td><td><select class="status-select" data-order="'+escapeHtml(x.id)+'" aria-label="অর্ডারের নতুন অবস্থা">'+Object.entries(statusNames).map(([k,v])=>'<option value="'+k+'" '+(x.status===k?"selected":"")+'>'+v+'</option>').join("")+'</select></td><td>'+escapeHtml(x.created_at?new Date(x.created_at).toLocaleString("bn-BD"):"—")+'</td><td><button type="button" class="secondary order-detail" data-order="'+escapeHtml(x.id)+'">বিস্তারিত</button></td></tr>').join("") || '<tr><td colspan="7">কোনো অর্ডার মেলেনি।</td></tr>';
      body.querySelectorAll(".order-detail").forEach(btn => btn.addEventListener("click", async () => {
        const orderId=btn.dataset.order, existing=body.querySelector('[data-detail-for="'+orderId+'"]');
        if(existing){existing.remove();btn.textContent="বিস্তারিত";return;}
        body.querySelectorAll("[data-detail-for]").forEach(x=>x.remove());
        body.querySelectorAll(".order-detail").forEach(x=>x.textContent="বিস্তারিত");
        btn.textContent="লোড হচ্ছে…";btn.disabled=true;
        try {
          const [detail,items]=await Promise.all([
            db.from("orders").select("order_number,customer_name,customer_phone,customer_address,subtotal,delivery_fee,total,payment_method,payment_status,notes,created_at").eq("id",orderId).single(),
            db.from("order_items").select("product_name,quantity,unit_price,line_total").eq("order_id",orderId)
          ]);
          if(detail.error)throw detail.error;if(items.error)throw items.error;
          const x=detail.data,fmt=v=>money(v),esc=escapeHtml;
          const tr=document.createElement("tr");tr.dataset.detailFor=orderId;
          tr.innerHTML='<td colspan="7"><div class="feature-card"><h3>অর্ডার: '+esc(x.order_number||orderId)+'</h3><p><b>ক্রেতা:</b> '+esc(x.customer_name||"—")+' · <b>মোবাইল:</b> '+esc(x.customer_phone||"—")+'</p><p><b>ঠিকানা:</b> '+esc(x.customer_address||"—")+'</p><div class="table-wrap"><table><thead><tr><th>পণ্য</th><th>পরিমাণ</th><th>একক দাম</th><th>মোট</th></tr></thead><tbody>'+(items.data||[]).map(it=>'<tr><td>'+esc(it.product_name||"—")+'</td><td>'+Number(it.quantity||0)+'</td><td>'+fmt(it.unit_price)+'</td><td>'+fmt(it.line_total)+'</td></tr>').join("")+'</tbody></table></div><p><b>পণ্যের মূল্য:</b> '+fmt(x.subtotal)+' · <b>ডেলিভারি:</b> '+fmt(x.delivery_fee)+' · <b>সর্বমোট:</b> '+fmt(x.total)+'</p><p><b>পেমেন্ট:</b> '+esc(x.payment_method||"—")+' / '+esc(x.payment_status||"—")+'</p><p><b>নোট:</b> '+esc(x.notes||"—")+'</p></div></td>';
          btn.closest("tr").after(tr);btn.textContent="বন্ধ করুন";
        } catch(err){toast("অর্ডারের বিস্তারিত আনা যায়নি: "+err.message);btn.textContent="বিস্তারিত";}
        finally{btn.disabled=false;}
      }));
      body.querySelectorAll(".status-select").forEach(sel => sel.addEventListener("change", async () => {
        const previous = rows.find(x=>x.id===sel.dataset.order)?.status;
        if (!previous || sel.value===previous) return;
        sel.disabled = true;
        const {error:e} = await db.rpc("admin_update_order_status",{p_order_id:sel.dataset.order,p_status:sel.value});
        if (e) {
          toast("স্ট্যাটাস পরিবর্তন হয়নি: "+e.message);
          sel.value = previous; sel.disabled = false;
        } else {
          const item=rows.find(x=>x.id===sel.dataset.order);
          if(item) item.status=sel.value;
          toast("অর্ডারের স্ট্যাটাস আপডেট হয়েছে");
          draw();
          await loadDashboard();
        }
      }));
    }
    search.addEventListener("input",draw);
    filter.addEventListener("change",draw);
    $("orderExport").addEventListener("click",()=>{
      const q=search.value.trim().toLocaleLowerCase(),st=filter.value;
      const filtered=rows.filter(x=>(!st||x.status===st)&&[x.order_number,x.customer_name].some(v=>String(v||"").toLocaleLowerCase().includes(q)));
      const values=[["Order number","Customer","Total","Status","Created"],...filtered.map(x=>[x.order_number||x.id,x.customer_name,x.total,x.status,x.created_at])];
      const csv="\uFEFF"+values.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
      const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
      const a=document.createElement("a");a.href=url;a.download="im-shop-orders.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    draw();
  }
  async function loadStaff() {
    const box = $("staffList");
    if (!box) return;
    const {data,error} = await db.from("staff_profiles")
      .select("user_id,full_name,role,is_active,created_at")
      .order("created_at",{ascending:false});
    if (error) {
      box.innerHTML = '<p class="pad error">স্টাফ তালিকা আনা যায়নি: ' + escapeHtml(error.message) + '</p>';
      return;
    }
    if (!data?.length) {
      box.innerHTML = '<p class="pad muted">এখনো কোনো স্টাফ প্রোফাইল নেই।</p>';
      return;
    }
    box.innerHTML = '<table><thead><tr><th>নাম</th><th>ভূমিকা</th><th>অ্যাকাউন্ট</th><th>ইউজার আইডি</th></tr></thead><tbody>' +
      data.map(s => '<tr><td>' + escapeHtml(s.full_name || "নাম দেওয়া হয়নি") + '</td><td><select class="staff-role" data-user="' + escapeHtml(s.user_id) + '">' +
        ['admin','manager','staff'].map(r => '<option value="' + r + '"' + (s.role===r?' selected':'') + '>' + ({admin:'Admin',manager:'Manager',staff:'Staff'}[r]) + '</option>').join('') +
        '</select></td><td><label class="staff-active"><input type="checkbox" class="staff-status" data-user="' + escapeHtml(s.user_id) + '"' + (s.is_active?' checked':'') + '> সক্রিয়</label></td><td><code>' + escapeHtml(s.user_id) + '</code></td></tr>').join('') + '</tbody></table>';
    box.querySelectorAll(".staff-role").forEach(sel => sel.addEventListener("change", async () => {
      if (sel.dataset.user === currentUser.id && sel.value !== "admin") {
        toast("নিজের অ্যাডমিন ভূমিকা এখান থেকে পরিবর্তন করা যাবে না।"); await loadStaff(); return;
      }
      sel.disabled = true;
      const {error:e} = await db.from("staff_profiles").update({role:sel.value}).eq("user_id",sel.dataset.user);
      if (e) { toast("ভূমিকা পরিবর্তন হয়নি: " + e.message); }
      else { toast("স্টাফের ভূমিকা আপডেট হয়েছে।"); }
      await loadStaff();
    }));
    box.querySelectorAll(".staff-status").forEach(chk => chk.addEventListener("change", async () => {
      if (chk.dataset.user === currentUser.id && !chk.checked) {
        toast("নিজের অ্যাকাউন্ট এখান থেকে বন্ধ করা যাবে না।"); await loadStaff(); return;
      }
      chk.disabled = true;
      const {error:e} = await db.from("staff_profiles").update({is_active:chk.checked}).eq("user_id",chk.dataset.user);
      if (e) toast("অবস্থা পরিবর্তন হয়নি: " + e.message);
      else toast("স্টাফ অ্যাকাউন্টের অবস্থা আপডেট হয়েছে।");
      await loadStaff();
    }));
  }
  async function addProduct(e) {
    e.preventDefault(); const btn = $("productForm").querySelector("button[type=submit]"); btn.disabled=true;
    message("productMessage","পণ্য সংরক্ষণ হচ্ছে…");
    try {
      let imageUrl = null; const file = $("pImage").files[0];
      if (file) {
        if (file.size > 5*1024*1024) throw new Error("ছবির সাইজ ৫ MB-এর বেশি।");
        if (!["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("শুধু JPG, PNG বা WebP ছবি দিন।");
        const ext = file.name.split(".").pop().toLowerCase();
        const path = `${crypto.randomUUID()}.${ext}`;
        const {error:upErr} = await db.storage.from("products").upload(path,file,{contentType:file.type,upsert:false});
        if (upErr) throw upErr;
        const {data} = db.storage.from("products").getPublicUrl(path); imageUrl = data.publicUrl;
      }
      const {data,error} = await db.rpc("admin_add_product",{
        p_name:$("pName").value.trim(), p_description:$("pDescription").value.trim() || null,
        p_category_id:$("pCategory").value || null, p_price:Number($("pPrice").value),
        p_stock_quantity:Number($("pStock").value), p_image_url:imageUrl, p_sku:$("pSku").value.trim() || null
      });
      if (error) throw error;
      $("productForm").reset(); $("imagePreview").classList.add("hidden");
      message("productMessage","পণ্য সফলভাবে যোগ হয়েছে।");
      toast("নতুন পণ্য যোগ হয়েছে"); await Promise.all([loadProducts(),loadDashboard()]);
    } catch(err) { message("productMessage",err.message || "পণ্য যোগ করা যায়নি।",true); }
    finally { btn.disabled=false; }
  }
  async function init() {
    if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_ANON_KEY.startsWith("PASTE_")) {
      message("loginMessage","প্রথমে config.js ফাইলে Supabase anon/public key বসাতে হবে।",true); return;
    }
    db = window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
    const {data:{session}} = await db.auth.getSession();
    if (session?.user) {
      try { const profile=await getStaffProfile(session.user); if(profile){ await showApp(session.user,profile); } else { await db.auth.signOut(); message("loginMessage","এই অ্যাকাউন্টে সক্রিয় স্টাফ অনুমতি নেই।",true); } }
      catch(e) { message("loginMessage",e.message,true); }
    }
  }
  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault(); if (!db) return;
    message("loginMessage","লগইন যাচাই হচ্ছে…");
    const {data,error} = await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
    if (error) return message("loginMessage",error.message,true);
    try {
      const profile=await getStaffProfile(data.user);
      if(!profile){await db.auth.signOut();return message("loginMessage","এই অ্যাকাউন্টে সক্রিয় স্টাফ অনুমতি নেই।",true);}
      message("loginMessage",profile.role==="admin"?"অ্যাডমিন লগইন সফল।":"স্টাফ লগইন সফল।");
      await showApp(data.user,profile);
    } catch(err) { await db.auth.signOut(); message("loginMessage",err.message,true); }
  });
  $("logoutBtn").addEventListener("click",async()=>{await db.auth.signOut();showLogin();});
  $("sideNav").addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b)navigate(b.dataset.page);});
  document.addEventListener("click",e=>{const b=e.target.closest("[data-goto]");if(b)navigate(b.dataset.goto);});
  $("productForm").addEventListener("submit",addProduct);
  $("refreshOrders").addEventListener("click",loadOrders);
  $("refreshStaff").addEventListener("click",loadStaff);
  $("pImage").addEventListener("change",()=>{const f=$("pImage").files[0], box=$("imagePreview");if(!f){box.classList.add("hidden");return;}box.innerHTML=`<img alt="ছবির প্রিভিউ" src="${URL.createObjectURL(f)}">`;box.classList.remove("hidden");});
  init();
  if ("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
})();

(() => {
 const C=window.IMSHOP_CONFIG||{};
 if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 let activeId=null, channel=null;
 async function load(){
  const el=$("chatPanel");if(!el)return;
  el.innerHTML='<p class="muted pad">চ্যাট লোড হচ্ছে…</p>';
  const {data,error}=await db.from("support_conversations").select("id,customer_name,customer_phone,subject,status,updated_at").order("updated_at",{ascending:false}).limit(100);
  if(error){el.innerHTML='<p class="error pad">চ্যাট ডেটাবেসে সংযোগ হয়নি: '+esc(error.message)+'<br>কাস্টমার চ্যাট চালু করতে স্টোরফ্রন্টের চ্যাট উইজেট সংযুক্ত করতে হবে।</p>';return;}
  const rows=data||[];
  el.innerHTML='<div class="chat-layout"><div class="chat-list"><h3>কথোপকথন ('+rows.length+')</h3>'+(rows.length?rows.map(x=>'<button type="button" class="chat-thread '+(x.id===activeId?'active':'')+'" data-id="'+x.id+'"><b>'+esc(x.customer_name)+'</b><small>'+esc(x.customer_phone||x.subject||"নতুন মেসেজ")+'</small><small>'+esc(x.status==="open"?"চলমান":"বন্ধ")+'</small></button>').join(""):'<p class="muted">এখনো কোনো কাস্টমার মেসেজ আসেনি।</p>')+'</div><div class="chat-main" id="chatThread"><p class="muted pad">বাম পাশ থেকে একটি কথোপকথন নির্বাচন করুন।</p></div></div>';
  el.querySelectorAll(".chat-thread").forEach(b=>b.onclick=()=>openThread(b.dataset.id));
 }
 async function openThread(id){
  activeId=id;
  const box=$("chatThread");if(!box)return;
  box.innerHTML='<p class="muted pad">মেসেজ লোড হচ্ছে…</p>';
  const [conv,msgs,user]=await Promise.all([
   db.from("support_conversations").select("id,customer_name,customer_phone,status").eq("id",id).single(),
   db.from("support_messages").select("id,sender_type,body,created_at").eq("conversation_id",id).order("created_at"),
   db.auth.getUser()
  ]);
  if(conv.error||msgs.error){box.innerHTML='<p class="error pad">'+esc((conv.error||msgs.error).message)+'</p>';return;}
  box.innerHTML='<div class="chat-head"><b>'+esc(conv.data.customer_name)+'</b><small>'+esc(conv.data.customer_phone||"ফোন নম্বর নেই")+'</small><button type="button" class="secondary" id="chatToggle">'+(conv.data.status==="open"?"চ্যাট বন্ধ করুন":"চ্যাট খুলুন")+'</button></div><div class="chat-messages" id="chatMessages">'+(msgs.data||[]).map(m=>'<div class="chat-bubble '+(m.sender_type==="admin"?"mine":"theirs")+'"><p>'+esc(m.body)+'</p><small>'+new Date(m.created_at).toLocaleString("bn-BD")+'</small></div>').join("")+'</div><form id="chatReply" class="chat-reply"><textarea name="body" required maxlength="5000" rows="2" placeholder="কাস্টমারকে উত্তর লিখুন…"></textarea><button class="primary" type="submit">উত্তর পাঠান</button></form>';
  $("chatToggle").onclick=async()=>{const next=conv.data.status==="open"?"closed":"open";const {error}=await db.from("support_conversations").update({status:next,updated_at:new Date().toISOString()}).eq("id",id);if(error)alert(error.message);else load();};
  $("chatReply").onsubmit=async ev=>{ev.preventDefault();const btn=ev.currentTarget.querySelector("button"),body=String(new FormData(ev.currentTarget).get("body")||"").trim();if(!body)return;btn.disabled=true;
   const {error}=await db.from("support_messages").insert({conversation_id:id,sender_type:"admin",sender_user_id:user.data.user?.id||null,body});
   if(error)alert("উত্তর পাঠানো যায়নি: "+error.message);else{await db.from("support_conversations").update({updated_at:new Date().toISOString()}).eq("id",id);openThread(id);}
   btn.disabled=false;
  };
  if(channel)db.removeChannel(channel);
  channel=db.channel("support-"+id).on("postgres_changes",{event:"INSERT",schema:"public",table:"support_messages",filter:"conversation_id=eq."+id},()=>openThread(id)).subscribe();
 }
 $("chatRefresh")?.addEventListener("click",load);
 document.getElementById("sideNav")?.addEventListener("click",ev=>{if(ev.target.closest('[data-page="chat"]'))setTimeout(()=>load(),350);});
 window.addEventListener("beforeunload",()=>{if(channel)db.removeChannel(channel);});
})();