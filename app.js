(() => {
  const cfg = window.IMSHOP_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const statusNames = {pending:"পেন্ডিং", confirmed:"কনফার্ম", processing:"প্রসেসিং", shipped:"পাঠানো হয়েছে", delivered:"ডেলিভারি সম্পন্ন", cancelled:"বাতিল"};
  let db = null;
  let currentUser = null;
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
  function showApp(user) {
    currentUser = user;
    $("loginView").classList.add("hidden"); $("appView").classList.remove("hidden");
    $("adminEmail").textContent = user.email || "Admin";
    navigate("dashboard"); refreshAll();
  }
  function showLogin() { $("appView").classList.add("hidden"); $("loginView").classList.remove("hidden"); }
  async function isAdmin(user) {
    const { data, error } = await db.from("staff_profiles")
      .select("role,is_active").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    return !!data && data.is_active === true && data.role === "admin";
  }
  async function refreshAll() {
    await Promise.allSettled([loadDashboard(), loadProducts(), loadCategories(), loadOrders(), loadStaff()]);
  }
  function navigate(page) {
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    $("page-" + page).classList.remove("hidden");
    document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.page === page));
    const titles = {dashboard:"ড্যাশবোর্ড",products:"পণ্যসমূহ",addProduct:"পণ্য যোগ করুন",orders:"অর্ডারসমূহ",staff:"স্টাফ ম্যানেজমেন্ট",settings:"সেটিংস",categories:"ক্যাটাগরি",inventory:"স্টক ও ইনভেন্টরি",customers:"কাস্টমার",reports:"বিক্রয় ও রিপোর্ট",payments:"পেমেন্ট",delivery:"ডেলিভারি",marketing:"কুপন ও প্রচার",notifications:"নোটিফিকেশন",security:"নিরাপত্তা"};
    $("pageTitle").textContent = titles[page] || "ড্যাশবোর্ড";
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
  function orderTable(rows, actions) {
    if (!rows.length) return '<p class="pad muted">এখনো কোনো অর্ডার নেই।</p>';
    return `<table><thead><tr><th>অর্ডার</th><th>ক্রেতা</th><th>মোট</th><th>অবস্থা</th>${actions?"<th>পরিবর্তন</th>":""}</tr></thead><tbody>` +
      rows.map(x=>`<tr><td>${escapeHtml(x.order_number)}</td><td>${escapeHtml(x.customer_name)}</td><td>${money(x.total)}</td><td><span class="status">${statusNames[x.status]||escapeHtml(x.status)}</span></td>` +
      (actions?`<td><select class="status-select" data-order="${x.id}">${Object.entries(statusNames).map(([k,v])=>`<option value="${k}" ${x.status===k?"selected":""}>${v}</option>`).join("")}</select></td>`:"")+
      `</tr>`).join("") + "</tbody></table>";
  }
  async function loadOrders() {
    const {data,error} = await db.from("orders").select("id,order_number,customer_name,total,status,created_at").order("created_at",{ascending:false}).limit(100);
    $("ordersList").innerHTML = error ? `<p class="pad error">${escapeHtml(error.message)}</p>` : orderTable(data||[],true);
    $("ordersList").querySelectorAll(".status-select").forEach(sel => sel.addEventListener("change", async () => {
      sel.disabled = true;
      const {error:e} = await db.rpc("admin_update_order_status",{p_order_id:sel.dataset.order,p_status:sel.value});
      if (e) { toast("স্ট্যাটাস পরিবর্তন হয়নি: " + e.message); sel.disabled=false; await loadOrders(); }
      else { toast("অর্ডারের স্ট্যাটাস আপডেট হয়েছে"); await Promise.all([loadOrders(),loadDashboard()]); }
    }));
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
      try { if (await isAdmin(session.user)) showApp(session.user); else { await db.auth.signOut(); message("loginMessage","এই অ্যাকাউন্টে অ্যাডমিন অনুমতি নেই।",true); } }
      catch(e) { message("loginMessage",e.message,true); }
    }
  }
  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault(); if (!db) return;
    message("loginMessage","লগইন যাচাই হচ্ছে…");
    const {data,error} = await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
    if (error) return message("loginMessage",error.message,true);
    try {
      if (!(await isAdmin(data.user))) { await db.auth.signOut(); return message("loginMessage","এই অ্যাকাউন্ট অ্যাডমিন হিসেবে অনুমোদিত নয়।",true); }
      message("loginMessage","লগইন সফল।"); showApp(data.user);
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