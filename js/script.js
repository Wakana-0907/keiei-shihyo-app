// このファイルは使われていません。public/js/app.js（+ server/lib/以下）を参照してください。
// ---------- ベンチマークデータ（中小企業庁 令和4年中小企業実態基本調査速報より） ----------
const ALL_INDUSTRY_AVG = {
  roe: 8.29,            // 自己資本当期純利益率
  profitMargin: 4.26,   // 売上高経常利益率
  turnover: 0.98,        // 総資本回転率(回)
  equityRatio: 40.13,   // 自己資本比率
  valueAddedRatio: 26.93 // 付加価値比率
};

// 業種別 参考値（公表された売上高・経常利益・従業者数・付加価値額から算出）
const INDUSTRY_BENCH = {
  "全産業（合計）":                    { profitMargin: 4.83,  productivity: 958.7  },
  "建設業":                            { profitMargin: 5.45,  productivity: 937.0  },
  "製造業":                            { profitMargin: 5.28,  productivity: 900.0  },
  "情報通信業":                        { profitMargin: 7.81,  productivity: 702.1  },
  "運輸業，郵便業":                     { profitMargin: 2.38,  productivity: 680.1  },
  "卸売業":                            { profitMargin: 2.63,  productivity: 812.7  },
  "小売業":                            { profitMargin: 2.77,  productivity: 743.0  },
  "不動産業，物品賃貸業":                { profitMargin: 10.27, productivity: 1756.8 },
  "学術研究，専門・技術サービス業":       { profitMargin: 15.43, productivity: 980.4  },
  "宿泊業，飲食サービス業":              { profitMargin: 8.86,  productivity: 767.1  },
  "生活関連サービス業，娯楽業":          { profitMargin: 4.13,  productivity: 1534.0 },
  "サービス業（他に分類されないもの）":   { profitMargin: 5.71,  productivity: 553.4  }
};
const CURRENT_RATIO_GOOD = 150; // 目安(%)
const CURRENT_RATIO_BAD = 100;  // 目安(%)

const industrySelect = document.getElementById('industrySelect');
Object.keys(INDUSTRY_BENCH).forEach(name=>{
  const opt = document.createElement('option');
  opt.value = name; opt.textContent = name;
  industrySelect.appendChild(opt);
});
industrySelect.value = "小売業";

const REQUIRED_COLS = ["年度","売上高","経常利益","総資産","純資産","流動資産","流動負債","従業員数","付加価値額"];

const SAMPLE_CSV =
`年度,売上高,経常利益,総資産,純資産,流動資産,流動負債,従業員数,付加価値額
2022年3月期,150000000,4200000,95000000,32000000,48000000,38000000,12,40000000
2023年3月期,162000000,5100000,101000000,35500000,51000000,40000000,13,43500000
2024年3月期,171000000,4800000,108000000,38000000,53000000,44000000,13,45500000`;

let currentData = [];
let trendChartObj = null;
let benchChartObj = null;

function parseCSV(text){
  const lines = text.replace(/^﻿/, '').split(/\r\n|\n|\r/).filter(l=>l.trim().length>0);
  if(lines.length < 2) throw new Error("データ行がありません。ヘッダー行に加えて、少なくとも1年度分のデータが必要です。");
  const headers = lines[0].split(',').map(h=>h.trim());
  const missing = REQUIRED_COLS.filter(c=>!headers.includes(c));
  if(missing.length>0) throw new Error("CSVに次の列が見つかりません: " + missing.join(', '));

  return lines.slice(1).map(line=>{
    const cells = line.split(',').map(c=>c.trim());
    const row = {};
    headers.forEach((h,i)=>{ row[h] = cells[i] !== undefined ? cells[i] : ''; });
    const num = (v)=> {
      const n = parseFloat(String(v).replace(/,/g,''));
      return isNaN(n) ? 0 : n;
    };
    return {
      year: row["年度"],
      sales: num(row["売上高"]),
      profit: num(row["経常利益"]),
      assets: num(row["総資産"]),
      equity: num(row["純資産"]),
      currentAssets: num(row["流動資産"]),
      currentLiabilities: num(row["流動負債"]),
      employees: num(row["従業員数"]),
      valueAdded: num(row["付加価値額"])
    };
  });
}

function computeIndicators(row){
  const equityRatio = row.assets ? (row.equity/row.assets*100) : null;
  const profitMargin = row.sales ? (row.profit/row.sales*100) : null;
  const turnover = row.assets ? (row.sales/row.assets) : null;
  const roe = row.equity ? (row.profit/row.equity*100) : null;
  const currentRatio = row.currentLiabilities ? (row.currentAssets/row.currentLiabilities*100) : null;
  const productivity = row.employees ? (row.valueAdded/row.employees/10000) : null; // 万円/人
  return { equityRatio, profitMargin, turnover, roe, currentRatio, productivity };
}

function judge(value, bench, {higherIsBetter=true, thresholdGood=1.2, thresholdBad=0.8}={}){
  if(value===null || bench===null || bench===undefined) return {label:"—", cls:"mid"};
  const ratio = value / bench;
  if(higherIsBetter){
    if(ratio >= thresholdGood) return {label:"良好", cls:"good"};
    if(ratio >= thresholdBad) return {label:"平均的", cls:"mid"};
    return {label:"要注意", cls:"bad"};
  }
}

function judgeCurrentRatio(value){
  if(value===null) return {label:"—", cls:"mid"};
  if(value >= CURRENT_RATIO_GOOD) return {label:"良好", cls:"good"};
  if(value >= CURRENT_RATIO_BAD) return {label:"平均的", cls:"mid"};
  return {label:"要注意", cls:"bad"};
}

function fmt(v, digits=1){
  return v===null || v===undefined || isNaN(v) ? "—" : v.toFixed(digits);
}

function render(){
  if(currentData.length===0){
    document.getElementById('resultsArea').style.display='none';
    document.getElementById('emptyState').style.display='block';
    return;
  }
  document.getElementById('resultsArea').style.display='block';
  document.getElementById('emptyState').style.display='none';

  const industry = industrySelect.value;
  const bench = INDUSTRY_BENCH[industry];
  const rows = currentData.map(r=>({row:r, ind:computeIndicators(r)}));
  const latest = rows[rows.length-1];

  // ---- table ----
  const table = document.getElementById('indicatorTable');
  table.innerHTML = `
    <tr>
      <th>年度</th><th>自己資本比率(%)</th><th>売上高経常利益率(%)</th>
      <th>総資本回転率(回)</th><th>ROE(%)</th><th>流動比率(%)</th><th>労働生産性(万円/人)</th>
    </tr>
    ${rows.map(({row,ind})=>`
      <tr>
        <td>${row.year}</td>
        <td>${fmt(ind.equityRatio)}</td>
        <td>${fmt(ind.profitMargin)}</td>
        <td>${fmt(ind.turnover,2)}</td>
        <td>${fmt(ind.roe)}</td>
        <td>${fmt(ind.currentRatio)}</td>
        <td>${ind.productivity===null?"—":fmt(ind.productivity,0)}</td>
      </tr>`).join('')}
  `;

  // ---- trend chart ----
  const labels = rows.map(r=>r.row.year);
  if(trendChartObj) trendChartObj.destroy();
  trendChartObj = new Chart(document.getElementById('trendChart'), {
    type:'line',
    data:{
      labels,
      datasets:[
        { label:'自己資本比率', data: rows.map(r=>r.ind.equityRatio), borderColor:'#2f5d8a', backgroundColor:'#2f5d8a', tension:0.25 },
        { label:'売上高経常利益率', data: rows.map(r=>r.ind.profitMargin), borderColor:'#b3392c', backgroundColor:'#b3392c', tension:0.25 }
      ]
    },
    options:{ responsive:true, plugins:{legend:{position:'bottom', labels:{boxWidth:12, font:{size:11}}}}, scales:{y:{ticks:{font:{size:11}}}, x:{ticks:{font:{size:11}}}} }
  });

  // ---- benchmark chart (latest year vs industry) ----
  const benchLabels = ['自己資本比率','売上高経常利益率(業種)','総資本回転率×10','ROE'];
  const companyVals = [
    latest.ind.equityRatio, latest.ind.profitMargin, (latest.ind.turnover||0)*10, latest.ind.roe
  ];
  const benchVals = [
    ALL_INDUSTRY_AVG.equityRatio, bench.profitMargin, ALL_INDUSTRY_AVG.turnover*10, ALL_INDUSTRY_AVG.roe
  ];
  if(benchChartObj) benchChartObj.destroy();
  benchChartObj = new Chart(document.getElementById('benchChart'), {
    type:'bar',
    data:{
      labels: benchLabels,
      datasets:[
        { label:'自社（最新年度）', data: companyVals, backgroundColor:'#2f5d8a' },
        { label:'業種平均（参考）', data: benchVals, backgroundColor:'#c7ccd4' }
      ]
    },
    options:{ responsive:true, plugins:{legend:{position:'bottom', labels:{boxWidth:12, font:{size:11}}}}, scales:{y:{ticks:{font:{size:11}}}, x:{ticks:{font:{size:10}}}} }
  });

  // ---- diagnosis ----
  const items = [
    {
      name:'自己資本比率', value:latest.ind.equityRatio, unit:'%',
      benchLabel:`全産業平均 ${ALL_INDUSTRY_AVG.equityRatio}%`,
      judge: judge(latest.ind.equityRatio, ALL_INDUSTRY_AVG.equityRatio),
      detail:'財務の安全性（返済不要の自己資本がどれだけあるか）を示す指標。'
    },
    {
      name:'売上高経常利益率', value:latest.ind.profitMargin, unit:'%',
      benchLabel:`${industry}平均（参考） ${bench.profitMargin}%`,
      judge: judge(latest.ind.profitMargin, bench.profitMargin),
      detail:'本業でどれだけ効率的に利益を上げているかを示す収益性の指標。'
    },
    {
      name:'総資本回転率', value:latest.ind.turnover, unit:'回',
      benchLabel:`全産業平均 ${ALL_INDUSTRY_AVG.turnover}回`,
      judge: judge(latest.ind.turnover, ALL_INDUSTRY_AVG.turnover),
      detail:'保有する総資産をどれだけ効率的に売上に変えられているかを示す指標。'
    },
    {
      name:'自己資本当期純利益率（簡易ROE）', value:latest.ind.roe, unit:'%',
      benchLabel:`全産業平均 ${ALL_INDUSTRY_AVG.roe}%`,
      judge: judge(latest.ind.roe, ALL_INDUSTRY_AVG.roe),
      detail:'株主資本（自己資本）に対する利益率。経常利益で簡易計算（本来は当期純利益）。'
    },
    {
      name:'流動比率', value:latest.ind.currentRatio, unit:'%',
      benchLabel:`目安：150%以上=良好 / 100%未満=要注意`,
      judge: judgeCurrentRatio(latest.ind.currentRatio),
      detail:'短期的な支払い能力（資金繰りの余裕度）を示す指標。'
    }
  ];
  if(latest.ind.productivity !== null){
    items.push({
      name:'労働生産性（従業員1人当たり付加価値額）', value:latest.ind.productivity, unit:'万円/人',
      benchLabel:`${industry}平均（参考） ${bench.productivity}万円/人`,
      judge: judge(latest.ind.productivity, bench.productivity),
      detail:'従業員1人がどれだけの付加価値を生み出しているかを示す生産性の指標。'
    });
  }

  document.getElementById('diagList').innerHTML = items.map(it=>`
    <div class="diag-item">
      <div>
        <div class="diag-name">${it.name}</div>
        <div class="diag-detail">${it.detail}<br>${it.benchLabel}</div>
      </div>
      <div class="diag-right">
        <div class="diag-value">${fmt(it.value, it.unit==='回'?2:0)} ${it.unit}</div>
        <span class="badge ${it.judge.cls}">${it.judge.label}</span>
      </div>
    </div>
  `).join('');
}

function loadCSVText(text){
  try{
    currentData = parseCSV(text);
    render();
  }catch(e){
    alert("CSVの読み込みに失敗しました：\n" + e.message);
  }
}

document.getElementById('csvFile').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev)=> loadCSVText(ev.target.result);
  reader.readAsText(file, 'UTF-8');
});

document.getElementById('loadSampleBtn').addEventListener('click', ()=> loadCSVText(SAMPLE_CSV));

document.getElementById('downloadTemplateBtn').addEventListener('click', ()=>{
  const blob = new Blob([REQUIRED_COLS.join(',') + '\n'], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = '経営指標診断_テンプレート.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

industrySelect.addEventListener('change', render);
