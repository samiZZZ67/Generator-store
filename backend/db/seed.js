'use strict';
const { getDb, prepare, isPostgres } = require('./database');

async function seed() {
  const db = await getDb();

  const categories = [
    { id: 'Generators',   label_am: '⚡ ጀነሬተሮች',       label_en: '⚡ Generators',   sort_order: 1 },
    { id: 'Spare Parts',  label_am: '🔧 ስፔር ፓርት',      label_en: '🔧 Spare Parts',  sort_order: 2 },
    { id: 'Engine Parts', label_am: '🔩 ሞተር ክፍሎች',     label_en: '🔩 Engine Parts', sort_order: 3 },
    { id: 'Electrical',   label_am: '💡 AVR & ኤሌክትሪክ', label_en: '💡 Electrical',   sort_order: 4 },
    { id: 'Filters',      label_am: '🛢️ ፊልተሮች',        label_en: '🛢️ Filters',      sort_order: 5 },
    { id: 'Tools',        label_am: '🪛 መሳሪያዎች',       label_en: '🪛 Tools',         sort_order: 6 },
  ];

  const products = [
    { name_am:'Honda EU2200i 2.2KVA',       name_en:'Honda EU2200i 2.2KVA',          cat_id:'Generators',   price:32000, original_price: 36000, marketing_desc_am: 'ታዋቂ ምርት በቅናሽ!', marketing_desc_en: 'Top seller, discounted!', in_stock:1, icon:'⚡', desc_am:'ዝቅተኛ ድምፅ ያለው፣ ቀልጣፋ እና ለቤት ተስማሚ ጀነሬተር',    desc_en:'Low-noise, efficient inverter generator ideal for home use' },
    { name_am:'Yamaha EF5500 5.5KVA',       name_en:'Yamaha EF5500 5.5KVA',          cat_id:'Generators',   price:58000, original_price: null, marketing_desc_am: '', marketing_desc_en: '', in_stock:1, icon:'⚡', desc_am:'ኃይለኛ እና ዘላቂ፣ ለትልቅ ቤት ወይም ንግድ',                 desc_en:'Powerful and durable, for large homes or commercial use' },
    { name_am:'Firman 3KVA Silent',          name_en:'Firman 3KVA Silent',             cat_id:'Generators',   price:24500, original_price: 28000, marketing_desc_am: 'ልዩ ቅናሽ', marketing_desc_en: 'Special deal!', in_stock:1, icon:'⚡', desc_am:'የዝምታ ዓይነት ጀነሬተር፣ ዝቅተኛ ድምፅ',                   desc_en:'Silent type generator with low noise output' },
    { name_am:'Diesel 10KVA 3-Phase',        name_en:'Diesel 10KVA 3-Phase',           cat_id:'Generators',   price:105000, original_price: null, marketing_desc_am: '', marketing_desc_en: '', in_stock:0, icon:'🔋', desc_am:'ለኢንዱስትሪ የሚሆን ሶስት ፌዝ ዲዝል ጀነሬተር',              desc_en:'Industrial-grade 3-phase diesel generator' },
    { name_am:'AVR Voltage Reg. 5KVA',       name_en:'AVR Voltage Reg. 5KVA',          cat_id:'Electrical',   price:1400, original_price: 1800, marketing_desc_am: 'ለጀነሬተርዎ አስተማማኝ ጥበቃ', marketing_desc_en: 'Reliable protection for your generator', in_stock:1, icon:'💡', desc_am:'ቮልቴጅ ማረጋጊያ ለ5KVA ጀነሬተሮች',                     desc_en:'Automatic voltage regulator for 5KVA generators' },
    { name_am:'Carburetor (Honda Compat.)',   name_en:'Carburetor (Honda Compatible)',   cat_id:'Engine Parts', price:720, original_price: null, marketing_desc_am: '', marketing_desc_en: '', in_stock:1, icon:'🔩', desc_am:'ከ Honda ጀነሬተሮች ጋር የሚሰራ ካርቡሬተር',                desc_en:'Compatible carburetor for Honda generators' },
    { name_am:'NGK Spark Plug Set x4',        name_en:'NGK Spark Plug Set x4',          cat_id:'Spare Parts',  price:380, original_price: null, marketing_desc_am: '', marketing_desc_en: '', in_stock:1, icon:'🔧', desc_am:'ኦሪጅናል NGK ስፓርክ ፕለግ፣ 4 ስብስብ',                  desc_en:'Original NGK spark plugs, set of 4' },
    { name_am:'Oil Filter — Honda/Yamaha',    name_en:'Oil Filter — Honda/Yamaha',      cat_id:'Filters',      price:200, original_price: null, marketing_desc_am: '', marketing_desc_en: '', in_stock:1, icon:'🛢️', desc_am:'ለ Honda እና Yamaha ጀነሬተሮች ዘይት ፊልተር',             desc_en:'Oil filter compatible with Honda and Yamaha generators' },
    { name_am:'Air Filter 5–7KVA',            name_en:'Air Filter 5–7KVA',              cat_id:'Filters',      price:260, original_price: null, marketing_desc_am: '', marketing_desc_en: '', in_stock:1, icon:'🛢️', desc_am:'ለ 5 እስከ 7KVA ጀነሬተሮች የአየር ፊልተር',               desc_en:'Air filter for 5–7KVA generators' },
    { name_am:'Fuel Cap Universal',            name_en:'Fuel Cap Universal',             cat_id:'Spare Parts',  price:110, original_price: null, marketing_desc_am: '', marketing_desc_en: '', in_stock:1, icon:'🔧', desc_am:'ለሁሉም ጀነሬተሮች የሚሰራ ዩኒቨርሳል የነዳጅ ክዳን',           desc_en:'Universal fuel cap compatible with most generators' },
    { name_am:'Pull-Start Rope Assembly',      name_en:'Pull-Start Rope Assembly',       cat_id:'Engine Parts', price:320, original_price: null, marketing_desc_am: '', marketing_desc_en: '', in_stock:1, icon:'🔩', desc_am:'የ pull-start ገመድ ስብስብ ሙሉ',                      desc_en:'Complete pull-start rope assembly set' },
    { name_am:'Digital Voltmeter Panel',       name_en:'Digital Voltmeter Panel',        cat_id:'Electrical',   price:520, original_price: null, marketing_desc_am: '', marketing_desc_en: '', in_stock:1, icon:'💡', desc_am:'ዲጂታል ቮልትሜትር ፓኔል ለጀነሬተሮች',                    desc_en:'Digital voltmeter panel display for generators' },
  ];

  // Seed categories
  for (const cat of categories) {
    if (isPostgres()) {
      await prepare(db, `
        INSERT INTO categories (id, label_am, label_en, sort_order) 
        VALUES ($id, $label_am, $label_en, $sort_order)
        ON CONFLICT (id) DO NOTHING
      `).run(cat);
    } else {
      await prepare(db, `
        INSERT OR IGNORE INTO categories (id, label_am, label_en, sort_order) 
        VALUES ($id, $label_am, $label_en, $sort_order)
      `).run(cat);
    }
  }

  // Seed products (avoid duplicates by checking name_en)
  for (const p of products) {
    const exists = await prepare(db, `SELECT 1 FROM products WHERE name_en = $name_en`).get({ name_en: p.name_en });
    if (!exists) {
      await prepare(db, `
        INSERT INTO products (
          name_am, name_en, cat_id, price, original_price, 
          marketing_desc_am, marketing_desc_en, in_stock, icon, desc_am, desc_en
        ) VALUES (
          $name_am, $name_en, $cat_id, $price, $original_price, 
          $marketing_desc_am, $marketing_desc_en, $in_stock, $icon, $desc_am, $desc_en
        )
      `).run({
        ...p,
        original_price: p.original_price || null,
        marketing_desc_am: p.marketing_desc_am || '',
        marketing_desc_en: p.marketing_desc_en || ''
      });
    }
  }

  console.log(`✅ Seeded categories and products.`);
  process.exit(0);
}

seed().catch(err => { 
  console.error(err); 
  process.exit(1); 
});
