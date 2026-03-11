import { useState, useMemo, useEffect, useCallback } from "react";

const API_URL = "https://script.google.com/macros/s/AKfycbxtZufRuoyv_4KE9cMKyzVXUe7fk43C8fJAVk56iXIB_wkb_wMofVkWd0278QoH6DSBZA/exec";

const api = {
  get: (action) =>
    fetch(${API_URL}?action=${action})
      .then(r => r.json())
      .catch(() => null),
  post: (action, data) =>
    fetch(API_URL, { method: "POST", body: JSON.stringify({ action, data }) })
      .then(r => r.json())
      .catch(() => null),
  postRaw: (action, payload) =>
    fetch(API_URL, { method: "POST", body: JSON.stringify({ action, ...payload }) })
      .then(r => r.json())
      .catch(() => null),
};

const demoProducts = [
  { id: 1, name: "Çamaşır Suyu 5L",     category: "temizlik", stock: 48, minStock: 20, unit: "adet",  lastUpdate: "2026-03-10" },
  { id: 2, name: "Bulaşık Deterjanı 3L", category: "temizlik", stock: 12, minStock: 15, unit: "adet",  lastUpdate: "2026-03-09" },
  { id: 3, name: "Yer Temizleyici 1L",   category: "temizlik", stock: 30, minStock: 10, unit: "adet",  lastUpdate: "2026-03-08" },
  { id: 4, name: "Cam Temizleyici 750ml",category: "temizlik", stock: 8,  minStock: 10, unit: "adet",  lastUpdate: "2026-03-10" },
  { id: 5, name: "Su 0.5L Kasa",         category: "içecek",  stock: 60, minStock: 30, unit: "kasa",  lastUpdate: "2026-03-11" },
  { id: 6, name: "Meyve Suyu 1L",        category: "içecek",  stock: 18, minStock: 20, unit: "adet",  lastUpdate: "2026-03-09" },
  { id: 7, name: "Çay 500gr",            category: "içecek",  stock: 25, minStock: 10, unit: "paket", lastUpdate: "2026-03-07" },
  { id: 8, name: "Kahve 200gr",          category: "içecek",  stock: 6,  minStock: 8,  unit: "paket", lastUpdate: "2026-03-10" },
];

const demoMovements = [
  { id: 1, productId: 1, type: "giriş",  quantity: 24, date: "2026-03-10", person: "Ahmet Yılmaz", description: "Tedarikçi teslimatı" },
  { id: 2, productId: 4, type: "çıkış",  quantity: 5,  date: "2026-03-10", person: "Fatma Demir",  description: "Ofis kullanımı" },
  { id: 3, productId: 5, type: "giriş",  quantity: 30, date: "2026-03-11", person: "Mehmet Kaya",  description: "Haftalık sipariş" },
  { id: 4, productId: 8, type: "çıkış",  quantity: 4,  date: "2026-03-10", person: "Ayşe Çelik",   description: "Toplantı odası ihtiyacı" },
];

function exportToCSV(movements, products) {
  const BOM = "\uFEFF";
  const headers = ["Tarih", "Ürün", "Kategori", "İşlem", "Miktar", "Birim", "Sorumlu Kişi", "Açıklama"];
  const rows = movements.map(m => {
    const p = products.find(x => String(x.id) === String(m.productId));
    return [m.date, p?.name||"-", p?.category||"-", m.type==="giriş"?"Giriş":"Çıkış", m.quantity, p?.unit||"-", m.person||"-", m.description||"-"];
  });
  const csv = BOM + [headers,...rows].map(r=>r.map(c=>"${String(c).replace(/"/g,'""')}").join(",")).join("\n");
  const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=stok-hareketleri-${new Date().toISOString().split("T")[0]}.csv; a.click();
  URL.revokeObjectURL(url);
}

export default function StokTakip() {
  const [products,  setProducts]  = useState(demoProducts);
  const [movements, setMovements] = useState(demoMovements);
  const [loading,   setLoading]   = useState(false);
  const [syncing,   setSyncing]   = useState(false);
  const [syncMsg,   setSyncMsg]   = useState(null);

  const [activeTab,       setActiveTab]       = useState("dashboard");
  const [categoryFilter,  setCategoryFilter]  = useState("tümü");
  const [movFilter,       setMovFilter]       = useState("tümü");
  const [searchTerm,      setSearchTerm]      = useState("");
  const [exportFeedback,  setExportFeedback]  = useState(false);

  const [showProductModal,  setShowProductModal]  = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [editingProduct,    setEditingProduct]    = useState(null);
  const [movementProduct,   setMovementProduct]   = useState(null);

  const [productForm,  setProductForm]  = useState({ name:"", category:"temizlik", stock:"", minStock:"", unit:"adet" });
  const [movementForm, setMovementForm] = useState({ type:"giriş", quantity:"", person:"", description:"", date:new Date().toISOString().split("T")[0] });

  const showSync = (text, type) => { setSyncMsg({text,type}); setTimeout(()=>setSyncMsg(null),3000); };

  const loadFromSheets = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, movs] = await Promise.all([api.get("getProducts"), api.get("getMovements")]);
      if (Array.isArray(prods) && prods.length > 0)
        setProducts(prods.map(p=>({...p, stock:Number(p.stock), minStock:Number(p.minStock)})));
      if (Array.isArray(movs) && movs.length > 0)
        setMovements(movs.map(m=>({...m, quantity:Number(m.quantity)})));
      showSync("✓ Google Sheets ile senkronize edildi","ok");
    } catch {
      showSync("⚠ Sheets bağlantısı kurulamadı","err");
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadFromSheets(); }, [loadFromSheets]);

  const saveProduct = async () => {
    if (!productForm.name || productForm.stock==="" || productForm.minStock==="") return;
    const today = new Date().toISOString().split("T")[0];
    const updated = {...productForm, stock:+productForm.stock, minStock:+productForm.minStock, lastUpdate:today};
    if (editingProduct) {
      const merged = {...editingProduct,...updated};
      setProducts(products.map(p=>p.id===editingProduct.id?merged:p));
      setSyncing(true); await api.post("updateProduct",merged); setSyncing(false);
      showSync("✓ Ürün güncellendi","ok");
    } else {
      const newP = {id:Date.now(),...updated};
      setProducts([...products,newP]);
      setSyncing(true); await api.post("saveProduct",newP); setSyncing(false);
      showSync("✓ Ürün kaydedildi","ok");
    }
    setShowProductModal(false);
  };

  const deleteProduct = async (id) => {
    setProducts(products.filter(p=>p.id!==id));
    await api.postRaw("deleteProduct",{id});
    showSync("✓ Ürün silindi","ok");
  };

  const saveMovement = async () => {
    if (!movementForm.quantity || +movementForm.quantity<=0) return;
    const qty = +movementForm.quantity;
    const newMov = {id:Date.now(), productId:movementProduct.id, type:movementForm.type, quantity:qty, date:movementForm.date, person:movementForm.person, description:movementForm.description};
    setProducts(products.map(p=>{
      if (p.id!==movementProduct.id) return p;
      return {...p, stock:movementForm.type==="giriş"?p.stock+qty:Math.max(0,p.stock-qty), lastUpdate:movementForm.date};
    }));
    setMovements([newMov,...movements]);
    setSyncing(true); await api.post("saveMovement",newMov); setSyncing(false);
    showSync("✓ Hareket kaydedildi","ok");
    setShowMovementModal(false);
  };

  const openMovement    = (p) => { setMovementProduct(p); setMovementForm({type:"giriş",quantity:"",person:"",description:"",date:new Date().toISOString().split("T")[0]}); setShowMovementModal(true); };
  const openEditProduct = (p) => { setEditingProduct(p); setProductForm({name:p.name,category:p.category,stock:p.stock,minStock:p.minStock,unit:p.unit}); setShowProductModal(true); };
  const openAddProduct  = ()  => { setEditingProduct(null); setProductForm({name:"",category:"temizlik",stock:"",minStock:"",unit:"adet"}); setShowProductModal(true); };
  const handleExport    = ()  => { exportToCSV(movements,products); setExportFeedback(true); setTimeout(()=>setExportFeedback(false),2000); };

  const getStatus = (p) => {
    if (p.stock===0)               return {label:"Tükendi",color:"#ef4444",bg:"#3d0a0a"};
    if (p.stock<=p.minStock)       return {label:"Kritik", color:"#f97316",bg:"#2d1400"};
    if (p.stock<=p.minStock*1.5)   return {label:"Az",     color:"#eab308",bg:"#2a2000"};
    return                                {label:"Yeterli",color:"#22c55e",bg:"#0d2218"};
  };

  const avatarInitials = (name) => name?name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase():"?";

  const lowStock         = products.filter(p=>p.stock<=p.minStock);
  const cleaningProducts = products.filter(p=>p.category==="temizlik");
  const drinkProducts    = products.filter(p=>p.category==="içecek");
  const filteredProducts = useMemo(()=>products.filter(p=>(categoryFilter==="tümü"||p.category===categoryFilter)&&p.name.toLowerCase().includes(searchTerm.toLowerCase())),[products,categoryFilter,searchTerm]);
  const filteredMovements= useMemo(()=>movements.filter(m=>movFilter==="tümü"||m.type===movFilter),[movements,movFilter]);

  return (
    <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",background:"#0f1117",minHeight:"100vh",color:"#e2e8f0"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#1a1d27}::-webkit-scrollbar-thumb{background:#3b4167;border-radius:4px}
        input,select{font-family:inherit}
        .btn{border:none;cursor:pointer;font-family:inherit;border-radius:8px;font-weight:600;transition:all .15s}
        .btn:hover{filter:brightness(1.1);transform:translateY(-1px)}
        .btn:active{transform:translateY(0)}
        .tab{background:none;border:none;cursor:pointer;font-family:inherit;transition:all .2s}
        .card{background:#1a1d27;border:1px solid #2a2d3e;border-radius:16px}
        .row:hover{background:#1f2235!important}
        .chip{border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;letter-spacing:.5px;font-family:'Space Mono',monospace}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(4px)}
        .modal{background:#1a1d27;border:1px solid #2a2d3e;border-radius:20px;padding:28px;width:460px;max-width:95vw;max-height:90vh;overflow-y:auto}
        .inp{background:#0f1117;border:1px solid #2a2d3e;border-radius:10px;padding:10px 14px;color:#e2e8f0;width:100%;font-size:14px;outline:none;transition:border-color .2s}
        .inp:focus{border-color:#6c63ff}
        .lbl{font-size:11px;color:#64748b;display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;font-weight:600}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .pulse{animation:pulse 2s infinite}
        .spin{display:inline-block;animation:spin 1s linear infinite}
      `}</style>

      {/* Header */}
      <div style={{background:"#13151f",borderBottom:"1px solid #2a2d3e",padding:"0 24px"}}>
        <div style={{maxWidth:1140,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:64}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:36,height:36,background:"linear-gradient(135deg,#6c63ff,#48c6ef)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📦</div>
            <div>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:15,fontWeight:700,color:"#fff"}}>StokPanel</div>
              <div style={{fontSize:11,color:"#64748b"}}>Holding Merkezi</div>
            </div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#22c55e",background:"#0d2218",border:"1px solid #166534",borderRadius:8,padding:"5px 10px"}}>
              {loading ? <span className="spin">⟳</span> : "●"} Sheets Bağlı
              <button className="btn" onClick={loadFromSheets} style={{background:"none",color:"#22c55e",fontSize:13,padding:"0 4px"}} title="Yenile">⟳</button>
            </div>
            {syncing && <div style={{fontSize:11,color:"#a78bfa"}}><span className="spin">⟳</span> Kaydediliyor...</div>}
            {syncMsg  && <div style={{fontSize:11,color:syncMsg.type==="ok"?"#4ade80":"#f87171",background:syncMsg.type==="ok"?"#0d2218":"#2d1b1b",border:1px solid ${syncMsg.type==="ok"?"#166534":"#7f1d1d"},borderRadius:8,padding:"5px 10px"}}>{syncMsg.text}</div>}
            {lowStock.length>0 && <div className="pulse" style={{background:"#2d1b1b",border:"1px solid #7f1d1d",borderRadius:10,padding:"6px 14px",fontSize:12,color:"#fca5a5"}}>⚠️ {lowStock.length} kritik stok</div>}
            <button className="btn" onClick={handleExport} style={{padding:"8px 16px",background:exportFeedback?"#166534":"#1a2e1a",color:exportFeedback?"#4ade80":"#22c55e",border:"1px solid #166534",fontSize:12}}>
              {exportFeedback?"✓ İndiriliyor...":"⬇ Excel'e Aktar"}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{background:"#13151f",borderBottom:"1px solid #2a2d3e",padding:"0 24px"}}>
        <div style={{maxWidth:1140,margin:"0 auto",display:"flex",gap:4}}>
          {[{id:"dashboard",label:"📊 Özet"},{id:"products",label:"📦 Ürünler"},{id:"movements",label:"🔄 Hareketler"}].map(t=>(
            <button key={t.id} className="tab" onClick={()=>setActiveTab(t.id)}
              style={{padding:"14px 18px",fontSize:13,fontWeight:600,color:activeTab===t.id?"#6c63ff":"#64748b",borderBottom:activeTab===t.id?"2px solid #6c63ff":"2px solid transparent"}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{maxWidth:1140,margin:"0 auto",padding:24}}>

        {/* DASHBOARD */}
        {activeTab==="dashboard" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16,marginBottom:24}}>
              {[{label:"Toplam Ürün",value:products.length,icon:"📦",color:"#6c63ff"},{label:"Temizlik",value:cleaningProducts.length,icon:"🧹",color:"#48c6ef"},{label:"İçecek",value:drinkProducts.length,icon:"🥤",color:"#22c55e"},{label:"Kritik Stok",value:lowStock.length,icon:"⚠️",color:"#ef4444"}].map((s,i)=>(
                <div key={i} className="card" style={{padding:"20px 24px",transition:"transform .2s",cursor:"default"}}
                  onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
                  onMouseLeave={e=>e.currentTarget.style.transform="none"}>
                  <div style={{fontSize:24,marginBottom:8}}>{s.icon}</div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:28,fontWeight:700,color:s.color}}>{s.value}</div>
                  <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{s.label}</div>
                </div>
              ))}
            </div>
            {lowStock.length>0 && (
              <div className="card" style={{padding:20,marginBottom:24,borderColor:"#7f1d1d"}}>
                <div style={{fontSize:13,fontWeight:700,color:"#fca5a5",marginBottom:14}}>⚠️ Kritik Stok Uyarıları</div>
                {lowStock.map(p=>{const s=getStatus(p);return(
                  <div key={p.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#0f1117",borderRadius:10,padding:"10px 14px",marginBottom:8}}>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <span style={{fontSize:16}}>{p.category==="temizlik"?"🧹":"🥤"}</span>
                      <div><div style={{fontSize:13,fontWeight:600}}>{p.name}</div><div style={{fontSize:11,color:"#64748b"}}>Min: {p.minStock} {p.unit}</div></div>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span className="chip" style={{background:s.bg,color:s.color}}>{p.stock} {p.unit}</span>
                      <button className="btn" onClick={()=>openMovement(p)} style={{background:"#1e293b",color:"#94a3b8",padding:"5px 12px",fontSize:12}}>Giriş Yap</button>
                    </div>
                  </div>
                );})}
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              {[{label:"Temizlik Ürünleri",icon:"🧹",items:cleaningProducts,color:"#48c6ef"},{label:"İçecek Ürünleri",icon:"🥤",items:drinkProducts,color:"#22c55e"}].map((cat,i)=>(
                <div key={i} className="card" style={{padding:20}}>
                  <div style={{fontSize:13,fontWeight:700,color:cat.color,marginBottom:14}}>{cat.icon} {cat.label}</div>
                  {cat.items.slice(0,5).map(p=>{const s=getStatus(p);const pct=Math.min(100,(p.stock/(p.minStock*3))*100);return(
                    <div key={p.id} style={{marginBottom:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:12,color:"#94a3b8"}}>{p.name}</span>
                        <span style={{fontSize:11,fontFamily:"'Space Mono',monospace",color:s.color}}>{p.stock} {p.unit}</span>
                      </div>
                      <div style={{background:"#0f1117",borderRadius:4,height:4,overflow:"hidden"}}>
                        <div style={{width:${pct}%,height:"100%",background:s.color,borderRadius:4,transition:"width .5s"}}/>
                      </div>
                    </div>
                  );})}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PRODUCTS */}
        {activeTab==="products" && (
          <div>
            <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
              <input className="inp" placeholder="🔍 Ürün ara..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} style={{flex:1,minWidth:200}}/>
              <div style={{display:"flex",gap:6}}>
                {["tümü","temizlik","içecek"].map(cat=>(
                  <button key={cat} className="btn" onClick={()=>setCategoryFilter(cat)}
                    style={{padding:"10px 16px",fontSize:12,background:categoryFilter===cat?"#6c63ff":"#1a1d27",color:categoryFilter===cat?"#fff":"#64748b",border:1px solid ${categoryFilter===cat?"#6c63ff":"#2a2d3e"}}}>
                    {cat==="tümü"?"Tümü":cat==="temizlik"?"🧹 Temizlik":"🥤 İçecek"}
                  </button>
                ))}
              </div>
              <button className="btn" onClick={openAddProduct} style={{padding:"10px 20px",background:"#6c63ff",color:"#fff",fontSize:13}}>+ Ürün Ekle</button>
            </div>
            <div className="card" style={{overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{borderBottom:"1px solid #2a2d3e"}}>
                  {["Ürün","Kategori","Stok","Min. Stok","Durum","Son Güncelleme","İşlemler"].map(h=>(
                    <th key={h} style={{padding:"12px 16px",fontSize:11,fontWeight:700,color:"#64748b",textAlign:"left",letterSpacing:.5,textTransform:"uppercase"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filteredProducts.map(p=>{const s=getStatus(p);return(
                    <tr key={p.id} className="row" style={{borderBottom:"1px solid #1f2235"}}>
                      <td style={{padding:"12px 16px",fontSize:13,fontWeight:500}}>{p.name}</td>
                      <td style={{padding:"12px 16px"}}><span className="chip" style={{background:p.category==="temizlik"?"#0c1a2e":"#0d2218",color:p.category==="temizlik"?"#48c6ef":"#22c55e"}}>{p.category==="temizlik"?"🧹":"🥤"} {p.category}</span></td>
                      <td style={{padding:"12px 16px",fontFamily:"'Space Mono',monospace",fontSize:13,color:s.color,fontWeight:700}}>{p.stock} <span style={{fontSize:10,color:"#64748b",fontWeight:400}}>{p.unit}</span></td>
                      <td style={{padding:"12px 16px",fontFamily:"'Space Mono',monospace",fontSize:12,color:"#64748b"}}>{p.minStock} {p.unit}</td>
                      <td style={{padding:"12px 16px"}}><span className="chip" style={{background:s.bg,color:s.color}}>{s.label}</span></td>
                      <td style={{padding:"12px 16px",fontSize:12,color:"#64748b"}}>{p.lastUpdate}</td>
                      <td style={{padding:"12px 16px"}}>
                        <div style={{display:"flex",gap:6}}>
                          <button className="btn" onClick={()=>openMovement(p)}     style={{padding:"5px 10px",fontSize:11,background:"#162032",color:"#48c6ef"}}>±</button>
                          <button className="btn" onClick={()=>openEditProduct(p)}  style={{padding:"5px 10px",fontSize:11,background:"#1e1a35",color:"#a78bfa"}}>✏️</button>
                          <button className="btn" onClick={()=>deleteProduct(p.id)} style={{padding:"5px 10px",fontSize:11,background:"#2d1b1b",color:"#f87171"}}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
              {filteredProducts.length===0 && <div style={{padding:40,textAlign:"center",color:"#64748b",fontSize:13}}>Ürün bulunamadı.</div>}
            </div>
          </div>
        )}

        {/* MOVEMENTS */}
        {activeTab==="movements" && (
          <div>
            <div style={{display:"flex",gap:10,marginBottom:16,justifyContent:"space-between",flexWrap:"wrap"}}>
              <div style={{display:"flex",gap:6}}>
                {[{id:"tümü",label:"Tüm Hareketler"},{id:"giriş",label:"▲ Girişler"},{id:"çıkış",label:"▼ Çıkışlar"}].map(f=>(
                  <button key={f.id} className="btn" onClick={()=>setMovFilter(f.id)}
                    style={{padding:"8px 14px",fontSize:12,background:movFilter===f.id?"#1e293b":"#1a1d27",color:movFilter===f.id?"#e2e8f0":"#64748b",border:1px solid ${movFilter===f.id?"#475569":"#2a2d3e"}}}>
                    {f.label}
                  </button>
                ))}
              </div>
              <button className="btn" onClick={handleExport} style={{padding:"8px 16px",background:exportFeedback?"#166534":"#1a2e1a",color:exportFeedback?"#4ade80":"#22c55e",border:"1px solid #166534",fontSize:12}}>
                {exportFeedback?"✓ İndiriliyor...":"⬇ Excel'e Aktar (.csv)"}
              </button>
            </div>
            <div className="card" style={{overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{borderBottom:"1px solid #2a2d3e"}}>
                  {["Tarih","Ürün","İşlem","Miktar","Sorumlu Kişi","Açıklama"].map(h=>(
                    <th key={h} style={{padding:"12px 16px",fontSize:11,fontWeight:700,color:"#64748b",textAlign:"left",letterSpacing:.5,textTransform:"uppercase"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filteredMovements.map(m=>{
                    const p=products.find(x=>String(x.id)===String(m.productId));
                    return(
                      <tr key={m.id} className="row" style={{borderBottom:"1px solid #1f2235"}}>
                        <td style={{padding:"12px 16px",fontSize:12,fontFamily:"'Space Mono',monospace",color:"#64748b"}}>{m.date}</td>
                        <td style={{padding:"12px 16px",fontSize:13,color:"#e2e8f0"}}>{p?.name||"—"}</td>
                        <td style={{padding:"12px 16px"}}><span className="chip" style={{background:m.type==="giriş"?"#0d2218":"#2d1b1b",color:m.type==="giriş"?"#22c55e":"#f87171"}}>{m.type==="giriş"?"▲ Giriş":"▼ Çıkış"}</span></td>
                        <td style={{padding:"12px 16px",fontFamily:"'Space Mono',monospace",fontSize:13,fontWeight:700,color:m.type==="giriş"?"#22c55e":"#f87171"}}>
                          {m.type==="giriş"?"+":"-"}{m.quantity} <span style={{fontSize:10,color:"#64748b",fontWeight:400}}>{p?.unit}</span>
                        </td>
                        <td style={{padding:"12px 16px"}}>
                          {m.person
                            ?<div style={{display:"flex",alignItems:"center",gap:8}}>
                               <div style={{width:26,height:26,borderRadius:"50%",background:"#2e1a4a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#a78bfa",flexShrink:0}}>{avatarInitials(m.person)}</div>
                               <span style={{fontSize:13,color:"#c4b5fd"}}>{m.person}</span>
                             </div>
                            :<span style={{color:"#64748b",fontSize:12}}>—</span>
                          }
                        </td>
                        <td style={{padding:"12px 16px",fontSize:12,color:"#94a3b8"}}>{m.description||"—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredMovements.length===0 && <div style={{padding:40,textAlign:"center",color:"#64748b",fontSize:13}}>Hareket kaydı bulunamadı.</div>}
            </div>
          </div>
        )}
      </div>

      {/* PRODUCT MODAL */}
      {showProductModal && (
        <div className="overlay" onClick={()=>setShowProductModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:16,fontWeight:700,color:"#e2e8f0",marginBottom:20}}>{editingProduct?"✏️ Ürün Düzenle":"➕ Yeni Ürün"}</div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div><label className="lbl">Ürün Adı</label><input className="inp" value={productForm.name} onChange={e=>setProductForm({...productForm,name:e.target.value})} placeholder="Ör: Çamaşır Suyu 5L"/></div>
              <div><label className="lbl">Kategori</label>
                <select className="inp" value={productForm.category} onChange={e=>setProductForm({...productForm,category:e.target.value})}>
                  <option value="temizlik">🧹 Temizlik</option>
                  <option value="içecek">🥤 İçecek</option>
                </select>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                <div><label className="lbl">Stok</label><input className="inp" type="number" value={productForm.stock} onChange={e=>setProductForm({...productForm,stock:e.target.value})} placeholder="0"/></div>
                <div><label className="lbl">Min. Stok</label><input className="inp" type="number" value={productForm.minStock} onChange={e=>setProductForm({...productForm,minStock:e.target.value})} placeholder="0"/></div>
                <div><label className="lbl">Birim</label>
                  <select className="inp" value={productForm.unit} onChange={e=>setProductForm({...productForm,unit:e.target.value})}>
                    {["adet","kasa","paket","litre","kg"].map(u=><option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:20}}>
              <button className="btn" onClick={()=>setShowProductModal(false)} style={{flex:1,padding:10,background:"#1e293b",color:"#94a3b8",fontSize:13}}>İptal</button>
              <button className="btn" onClick={saveProduct} style={{flex:2,padding:10,background:"#6c63ff",color:"#fff",fontSize:13}}>Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* MOVEMENT MODAL */}
      {showMovementModal && movementProduct && (
        <div className="overlay" onClick={()=>setShowMovementModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:16,fontWeight:700,color:"#e2e8f0",marginBottom:4}}>🔄 Stok Hareketi</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:20}}>{movementProduct.name} — Mevcut: <span style={{color:"#e2e8f0",fontFamily:"'Space Mono',monospace"}}>{movementProduct.stock} {movementProduct.unit}</span></div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {["giriş","çıkış"].map(t=>(
                  <button key={t} className="btn" onClick={()=>setMovementForm({...movementForm,type:t})}
                    style={{padding:12,background:movementForm.type===t?(t==="giriş"?"#0d2218":"#2d1b1b"):"#1a1d27",color:movementForm.type===t?(t==="giriş"?"#22c55e":"#f87171"):"#64748b",border:1px solid ${movementForm.type===t?(t==="giriş"?"#22c55e":"#f87171"):"#2a2d3e"},fontSize:14}}>
                    {t==="giriş"?"▲ Giriş":"▼ Çıkış"}
                  </button>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div><label className="lbl">Miktar ({movementProduct.unit})</label><input className="inp" type="number" value={movementForm.quantity} onChange={e=>setMovementForm({...movementForm,quantity:e.target.value})} placeholder="0"/></div>
                <div><label className="lbl">Tarih</label><input className="inp" type="date" value={movementForm.date} onChange={e=>setMovementForm({...movementForm,date:e.target.value})}/></div>
              </div>
              <div><label className="lbl">Sorumlu Kişi {movementForm.type==="çıkış"&&<span style={{color:"#ef4444"}}>*</span>}</label><input className="inp" value={movementForm.person} onChange={e=>setMovementForm({...movementForm,person:e.target.value})} placeholder="Ad Soyad"/></div>
              <div><label className="lbl">Açıklama</label><input className="inp" value={movementForm.description} onChange={e=>setMovementForm({...movementForm,description:e.target.value})} placeholder={movementForm.type==="giriş"?"Ör: Tedarikçi teslimatı":"Ör: Toplantı odası ihtiyacı"}/></div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:20}}>
              <button className="btn" onClick={()=>setShowMovementModal(false)} style={{flex:1,padding:10,background:"#1e293b",color:"#94a3b8",fontSize:13}}>İptal</button>
              <button className="btn" onClick={saveMovement} style={{flex:2,padding:10,background:movementForm.type==="giriş"?"#166534":"#7f1d1d",color:"#fff",fontSize:13}}>
                {movementForm.type==="giriş"?"▲ Giriş Kaydet":"▼ Çıkış Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
