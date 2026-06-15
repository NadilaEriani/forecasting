import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import "./App.css";

const jenisKendaraanList = [
  { label: "Total Kendaraan", value: "total_kendaraan", short: "Total" },
  { label: "Mobil Penumpang", value: "mobil_penumpang", short: "Mobil" },
  { label: "Bus", value: "bus", short: "Bus" },
  { label: "Truk", value: "truk", short: "Truk" },
  { label: "Sepeda Motor", value: "sepeda_motor", short: "Motor" },
];

const kolomKendaraan = [
  "mobil_penumpang",
  "bus",
  "truk",
  "sepeda_motor",
  "total_kendaraan",
];

function formatAngka(nilai) {
  const angka = Number(nilai || 0);
  return angka.toLocaleString("id-ID");
}

function formatCompact(nilai) {
  const angka = Number(nilai || 0);

  if (angka >= 1_000_000_000_000) {
    return `${(angka / 1_000_000_000_000).toFixed(1)} T`;
  }

  if (angka >= 1_000_000_000) {
    return `${(angka / 1_000_000_000).toFixed(1)} M`;
  }

  if (angka >= 1_000_000) {
    return `${(angka / 1_000_000).toFixed(1)} Jt`;
  }

  return formatAngka(angka);
}

function formatPersen(nilai) {
  const angka = Number(nilai || 0);
  if (!Number.isFinite(angka)) return "0,00%";
  return `${angka.toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function normalisasiNamaKolom(nilai) {
  return String(nilai || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (huruf) => huruf.toUpperCase());
}

function totalPerTahun(data, kolom) {
  const map = new Map();

  data.forEach((item) => {
    const tahun = Number(item.tahun);
    const nilai = Number(item[kolom] || 0);
    map.set(tahun, (map.get(tahun) || 0) + nilai);
  });

  return Array.from(map, ([tahun, nilai]) => ({ tahun, nilai })).sort(
    (a, b) => a.tahun - b.tahun,
  );
}

function ambilNilaiMaksimal(series) {
  const semuaNilai = series.flatMap((item) =>
    item.data.map((data) => data.nilai),
  );
  return Math.max(...semuaNilai, 1);
}

function TrendChart({ aktual, prediksi }) {
  const width = 920;
  const height = 320;
  const paddingX = 54;
  const paddingY = 42;

  const semuaTahun = [...aktual, ...prediksi].map((item) => item.tahun);
  const minTahun = Math.min(...semuaTahun, new Date().getFullYear());
  const maxTahun = Math.max(...semuaTahun, new Date().getFullYear());
  const maxNilai = ambilNilaiMaksimal([
    { label: "Aktual", data: aktual },
    { label: "Prediksi", data: prediksi },
  ]);

  function getX(tahun) {
    if (minTahun === maxTahun) return width / 2;
    return (
      paddingX +
      ((tahun - minTahun) / (maxTahun - minTahun)) * (width - paddingX * 2)
    );
  }

  function getY(nilai) {
    return (
      height -
      paddingY -
      (Number(nilai || 0) / maxNilai) * (height - paddingY * 2)
    );
  }

  function buatPath(data) {
    return data
      .map((item, index) => {
        const perintah = index === 0 ? "M" : "L";
        return `${perintah} ${getX(item.tahun)} ${getY(item.nilai)}`;
      })
      .join(" ");
  }

  const tahunLabel = Array.from(new Set(semuaTahun)).sort((a, b) => a - b);

  if (!aktual.length && !prediksi.length) {
    return <div className="empty-state">Belum ada data untuk grafik.</div>;
  }

  return (
    <div className="chart-shell">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Grafik tren forecasting kendaraan"
      >
        <defs>
          <linearGradient id="areaAktual" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="areaPrediksi" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((rasio) => {
          const y = paddingY + rasio * (height - paddingY * 2);
          return (
            <g key={rasio}>
              <line
                x1={paddingX}
                x2={width - paddingX}
                y1={y}
                y2={y}
                className="grid-line"
              />
              <text
                x={paddingX - 12}
                y={y + 4}
                textAnchor="end"
                className="axis-label"
              >
                {formatCompact(maxNilai * (1 - rasio))}
              </text>
            </g>
          );
        })}

        {tahunLabel.map((tahun) => (
          <text
            key={tahun}
            x={getX(tahun)}
            y={height - 12}
            textAnchor="middle"
            className="axis-label"
          >
            {tahun}
          </text>
        ))}

        {aktual.length > 0 && (
          <>
            <path
              d={`${buatPath(aktual)} L ${getX(aktual[aktual.length - 1].tahun)} ${height - paddingY} L ${getX(aktual[0].tahun)} ${height - paddingY} Z`}
              fill="url(#areaAktual)"
            />
            <path d={buatPath(aktual)} className="line-actual" fill="none" />
            {aktual.map((item) => (
              <circle
                key={`aktual-${item.tahun}`}
                cx={getX(item.tahun)}
                cy={getY(item.nilai)}
                r="4"
                className="dot-actual"
              />
            ))}
          </>
        )}

        {prediksi.length > 0 && (
          <>
            <path
              d={`${buatPath(prediksi)} L ${getX(prediksi[prediksi.length - 1].tahun)} ${height - paddingY} L ${getX(prediksi[0].tahun)} ${height - paddingY} Z`}
              fill="url(#areaPrediksi)"
            />
            <path
              d={buatPath(prediksi)}
              className="line-forecast"
              fill="none"
            />
            {prediksi.map((item) => (
              <circle
                key={`prediksi-${item.tahun}`}
                cx={getX(item.tahun)}
                cy={getY(item.nilai)}
                r="4"
                className="dot-forecast"
              />
            ))}
          </>
        )}
      </svg>
    </div>
  );
}

function CompositionBars({ data }) {
  const jenis = jenisKendaraanList.filter(
    (item) => item.value !== "total_kendaraan",
  );
  const total = jenis.reduce(
    (sum, item) => sum + Number(data?.[item.value] || 0),
    0,
  );

  if (!data || total === 0) {
    return (
      <div className="empty-state compact">
        Pilih provinsi untuk melihat komposisi kendaraan.
      </div>
    );
  }

  return (
    <div className="bar-list">
      {jenis.map((item) => {
        const nilai = Number(data[item.value] || 0);
        const persen = total ? (nilai / total) * 100 : 0;

        return (
          <div className="bar-item" key={item.value}>
            <div className="bar-info">
              <span>{item.label}</span>
              <strong>{formatCompact(nilai)}</strong>
            </div>
            <div className="bar-track">
              <div
                className={`bar-fill ${item.value}`}
                style={{ width: `${Math.max(persen, 1)}%` }}
              />
            </div>
            <small>{formatPersen(persen)}</small>
          </div>
        );
      })}
    </div>
  );
}

function App() {
  const [dataAktual, setDataAktual] = useState([]);
  const [dataPrediksi, setDataPrediksi] = useState([]);
  const [evaluasi, setEvaluasi] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pesan, setPesan] = useState("");
  const [error, setError] = useState("");

  const [filterProvinsi, setFilterProvinsi] = useState("Semua");
  const [filterJenis, setFilterJenis] = useState("total_kendaraan");
  const [filterStatus, setFilterStatus] = useState("Semua");
  const [pencarian, setPencarian] = useState("");

  const [form, setForm] = useState({
    provinsi: "",
    tahun: "",
    mobil_penumpang: "",
    bus: "",
    truk: "",
    sepeda_motor: "",
  });

  async function ambilData() {
    setLoading(true);
    setPesan("");
    setError("");

    const [aktualRes, prediksiRes, evaluasiRes] = await Promise.all([
      supabase
        .from("kendaraan_aktual")
        .select("*")
        .order("provinsi", { ascending: true })
        .order("tahun", { ascending: true }),
      supabase
        .from("prediksi_kendaraan")
        .select("*")
        .order("provinsi", { ascending: true })
        .order("tahun", { ascending: true }),
      supabase
        .from("evaluasi_model")
        .select("*")
        .order("jenis_kendaraan", { ascending: true }),
    ]);

    if (aktualRes.error || prediksiRes.error || evaluasiRes.error) {
      setError(
        "Data gagal dimuat. Periksa koneksi Supabase dan policy SELECT untuk anon.",
      );
      console.error({
        kendaraan_aktual: aktualRes.error,
        prediksi_kendaraan: prediksiRes.error,
        evaluasi_model: evaluasiRes.error,
      });
    } else {
      setDataAktual(aktualRes.data || []);
      setDataPrediksi(prediksiRes.data || []);
      setEvaluasi(evaluasiRes.data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    ambilData();
  }, []);

  const daftarProvinsi = useMemo(() => {
    const semua = [...dataAktual, ...dataPrediksi]
      .map((item) => item.provinsi)
      .filter(Boolean);
    return [
      "Semua",
      ...Array.from(new Set(semua)).sort((a, b) => a.localeCompare(b)),
    ];
  }, [dataAktual, dataPrediksi]);

  const dataGabungan = useMemo(() => {
    let gabungan = [
      ...dataAktual.map((item) => ({ ...item, sumber: "Aktual" })),
      ...dataPrediksi.map((item) => ({ ...item, sumber: "Prediksi" })),
    ];

    if (filterProvinsi !== "Semua") {
      gabungan = gabungan.filter((item) => item.provinsi === filterProvinsi);
    }

    if (filterStatus !== "Semua") {
      gabungan = gabungan.filter((item) => item.sumber === filterStatus);
    }

    if (pencarian.trim()) {
      const kata = pencarian.trim().toLowerCase();
      gabungan = gabungan.filter((item) =>
        `${item.provinsi} ${item.tahun} ${item.status}`
          .toLowerCase()
          .includes(kata),
      );
    }

    return gabungan.sort((a, b) => {
      if (a.provinsi === b.provinsi) return Number(a.tahun) - Number(b.tahun);
      return String(a.provinsi).localeCompare(String(b.provinsi));
    });
  }, [dataAktual, dataPrediksi, filterProvinsi, filterStatus, pencarian]);

  const dataTersaringAktual = useMemo(() => {
    if (filterProvinsi === "Semua") return dataAktual;
    return dataAktual.filter((item) => item.provinsi === filterProvinsi);
  }, [dataAktual, filterProvinsi]);

  const dataTersaringPrediksi = useMemo(() => {
    if (filterProvinsi === "Semua") return dataPrediksi;
    return dataPrediksi.filter((item) => item.provinsi === filterProvinsi);
  }, [dataPrediksi, filterProvinsi]);

  const trenAktual = useMemo(
    () => totalPerTahun(dataTersaringAktual, filterJenis),
    [dataTersaringAktual, filterJenis],
  );

  const trenPrediksi = useMemo(
    () => totalPerTahun(dataTersaringPrediksi, filterJenis),
    [dataTersaringPrediksi, filterJenis],
  );

  const dataKomposisi = useMemo(() => {
    const sumber = dataTersaringAktual.length
      ? dataTersaringAktual
      : dataAktual;
    const tahunTerbaru = Math.max(
      ...sumber.map((item) => Number(item.tahun || 0)),
      0,
    );
    const dataTahunTerbaru = sumber.filter(
      (item) => Number(item.tahun) === tahunTerbaru,
    );

    if (!dataTahunTerbaru.length) return null;

    return dataTahunTerbaru.reduce(
      (total, item) => ({
        mobil_penumpang:
          total.mobil_penumpang + Number(item.mobil_penumpang || 0),
        bus: total.bus + Number(item.bus || 0),
        truk: total.truk + Number(item.truk || 0),
        sepeda_motor: total.sepeda_motor + Number(item.sepeda_motor || 0),
      }),
      { mobil_penumpang: 0, bus: 0, truk: 0, sepeda_motor: 0 },
    );
  }, [dataTersaringAktual, dataAktual]);

  const ringkasan = useMemo(() => {
    const totalAktual = dataAktual.reduce(
      (total, item) => total + Number(item.total_kendaraan || 0),
      0,
    );
    const totalPrediksi = dataPrediksi.reduce(
      (total, item) => total + Number(item.total_kendaraan || 0),
      0,
    );
    const tahunAktual = Math.max(
      ...dataAktual.map((item) => Number(item.tahun || 0)),
      0,
    );
    const tahunPrediksi = Math.max(
      ...dataPrediksi.map((item) => Number(item.tahun || 0)),
      0,
    );
    const prediksiTerakhir = dataPrediksi
      .filter((item) => Number(item.tahun) === tahunPrediksi)
      .reduce((total, item) => total + Number(item.total_kendaraan || 0), 0);
    const aktualTerakhir = dataAktual
      .filter((item) => Number(item.tahun) === tahunAktual)
      .reduce((total, item) => total + Number(item.total_kendaraan || 0), 0);
    const rataMape = evaluasi.length
      ? evaluasi.reduce((total, item) => total + Number(item.mape || 0), 0) /
        evaluasi.length
      : 0;

    return {
      totalAktual,
      totalPrediksi,
      tahunAktual,
      tahunPrediksi,
      prediksiTerakhir,
      aktualTerakhir,
      rataMape,
      jumlahProvinsi: new Set(
        [...dataAktual, ...dataPrediksi].map((item) => item.provinsi),
      ).size,
    };
  }, [dataAktual, dataPrediksi, evaluasi]);

  const topProvinsiPrediksi = useMemo(() => {
    const tahun = ringkasan.tahunPrediksi;
    return dataPrediksi
      .filter((item) => Number(item.tahun) === tahun)
      .sort(
        (a, b) =>
          Number(b.total_kendaraan || 0) - Number(a.total_kendaraan || 0),
      )
      .slice(0, 5);
  }, [dataPrediksi, ringkasan.tahunPrediksi]);

  const insight = useMemo(() => {
    const labelJenis =
      jenisKendaraanList.find((item) => item.value === filterJenis)?.label ||
      "Total Kendaraan";
    const nilaiAkhirAktual = trenAktual[trenAktual.length - 1]?.nilai || 0;
    const nilaiAkhirPrediksi =
      trenPrediksi[trenPrediksi.length - 1]?.nilai || 0;
    const selisih = nilaiAkhirPrediksi - nilaiAkhirAktual;
    const persen = nilaiAkhirAktual ? (selisih / nilaiAkhirAktual) * 100 : 0;

    return {
      labelJenis,
      nilaiAkhirAktual,
      nilaiAkhirPrediksi,
      selisih,
      persen,
    };
  }, [filterJenis, trenAktual, trenPrediksi]);

  function handleInputChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function simpanDataAktual(e) {
    e.preventDefault();
    setPesan("");
    setError("");
    setSaving(true);

    const mobilPenumpang = Number(form.mobil_penumpang || 0);
    const bus = Number(form.bus || 0);
    const truk = Number(form.truk || 0);
    const sepedaMotor = Number(form.sepeda_motor || 0);

    const dataBaru = {
      provinsi: form.provinsi.trim(),
      tahun: Number(form.tahun),
      status: "Aktual",
      mobil_penumpang: mobilPenumpang,
      bus,
      truk,
      sepeda_motor: sepedaMotor,
      total_kendaraan: mobilPenumpang + bus + truk + sepedaMotor,
    };

    const { error: insertError } = await supabase
      .from("kendaraan_aktual")
      .insert(dataBaru);

    if (insertError) {
      setError(
        "Data gagal disimpan. Pastikan policy INSERT untuk tabel kendaraan_aktual sudah aktif.",
      );
      console.error(insertError);
      setSaving(false);
      return;
    }

    setPesan("Data aktual berhasil disimpan ke Supabase.");
    setForm({
      provinsi: "",
      tahun: "",
      mobil_penumpang: "",
      bus: "",
      truk: "",
      sepeda_motor: "",
    });

    await ambilData();
    setSaving(false);
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">FK</div>
          <div>
            <strong>Forecasting</strong>
            <span>Kendaraan</span>
          </div>
        </div>

        <nav className="side-nav">
          <a href="#ringkasan" className="active">
            Ringkasan
          </a>
          <a href="#tren">Tren Forecasting</a>
          <a href="#data">Data Kendaraan</a>
          <a href="#evaluasi">Evaluasi Model</a>
          <a href="#input">Input Data</a>
        </nav>

        <div className="sidebar-card">
          <span>Model</span>
          <strong>LSTM</strong>
          <p>
            Forecasting volume kendaraan berdasarkan jenis kendaraan dan
            provinsi.
          </p>
        </div>
      </aside>

      <main className="main-content">
        <header className="hero" id="ringkasan">
          <div className="hero-copy">
            <span className="eyebrow">Dashboard Prediksi Kendaraan</span>
            <h1>Forecasting Volume Kendaraan Indonesia</h1>
            <p>
              Pantau data aktual, prediksi masa depan, evaluasi model, dan input
              data kendaraan dari Supabase dalam satu dashboard interaktif.
            </p>
          </div>

          <div className="hero-panel">
            <span>Prediksi terakhir</span>
            <strong>{ringkasan.tahunPrediksi || "-"}</strong>
            <p>{formatCompact(ringkasan.prediksiTerakhir)} kendaraan</p>
            <button type="button" onClick={ambilData} disabled={loading}>
              {loading ? "Memuat..." : "Refresh Data"}
            </button>
          </div>
        </header>

        {(pesan || error) && (
          <div className={`message ${error ? "error" : "success"}`}>
            {error || pesan}
          </div>
        )}

        <section className="stat-grid">
          <article className="stat-card blue">
            <span>Total Aktual</span>
            <strong>{formatCompact(ringkasan.totalAktual)}</strong>
            <p>Data sampai tahun {ringkasan.tahunAktual || "-"}</p>
          </article>

          <article className="stat-card orange">
            <span>Total Prediksi</span>
            <strong>{formatCompact(ringkasan.totalPrediksi)}</strong>
            <p>Forecast sampai tahun {ringkasan.tahunPrediksi || "-"}</p>
          </article>

          <article className="stat-card green">
            <span>Provinsi</span>
            <strong>{formatAngka(ringkasan.jumlahProvinsi)}</strong>
            <p>Wilayah dalam dataset</p>
          </article>

          <article className="stat-card purple">
            <span>Rata-rata MAPE</span>
            <strong>{formatPersen(ringkasan.rataMape)}</strong>
            <p>Evaluasi performa LSTM</p>
          </article>
        </section>

        <section className="toolbar">
          <div>
            <label>Provinsi</label>
            <select
              value={filterProvinsi}
              onChange={(e) => setFilterProvinsi(e.target.value)}
            >
              {daftarProvinsi.map((provinsi) => (
                <option key={provinsi} value={provinsi}>
                  {provinsi}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Jenis Kendaraan</label>
            <select
              value={filterJenis}
              onChange={(e) => setFilterJenis(e.target.value)}
            >
              {jenisKendaraanList.map((jenis) => (
                <option key={jenis.value} value={jenis.value}>
                  {jenis.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="Semua">Semua</option>
              <option value="Aktual">Aktual</option>
              <option value="Prediksi">Prediksi</option>
            </select>
          </div>

          <div className="search-box">
            <label>Pencarian</label>
            <input
              value={pencarian}
              onChange={(e) => setPencarian(e.target.value)}
              placeholder="Cari provinsi / tahun"
            />
          </div>
        </section>

        <section className="content-grid" id="tren">
          <article className="panel panel-large">
            <div className="panel-header">
              <div>
                <span className="section-label">Tren Aktual vs Prediksi</span>
                <h2>{insight.labelJenis}</h2>
                <p>
                  {filterProvinsi === "Semua"
                    ? "Akumulasi semua provinsi"
                    : `Provinsi ${filterProvinsi}`}{" "}
                  berdasarkan data aktual dan hasil forecasting.
                </p>
              </div>

              <div className="legend">
                <span>
                  <i className="legend-dot actual" /> Aktual
                </span>
                <span>
                  <i className="legend-dot forecast" /> Prediksi
                </span>
              </div>
            </div>

            {loading ? (
              <div className="skeleton chart" />
            ) : (
              <TrendChart aktual={trenAktual} prediksi={trenPrediksi} />
            )}
          </article>

          <article className="panel insight-panel">
            <div className="panel-header compact-header">
              <div>
                <span className="section-label">Insight Forecast</span>
                <h2>Ringkasan</h2>
              </div>
            </div>

            <div className="insight-box">
              <span>Aktual terakhir</span>
              <strong>{formatCompact(insight.nilaiAkhirAktual)}</strong>
            </div>

            <div className="insight-box forecast-box">
              <span>Prediksi terakhir</span>
              <strong>{formatCompact(insight.nilaiAkhirPrediksi)}</strong>
            </div>

            <p className="insight-text">
              Selisih prediksi terhadap data aktual terakhir adalah{" "}
              <b>{formatCompact(insight.selisih)}</b> kendaraan atau{" "}
              <b>{formatPersen(insight.persen)}</b>.
            </p>
          </article>
        </section>

        <section className="content-grid two-column">
          <article className="panel">
            <div className="panel-header compact-header">
              <div>
                <span className="section-label">Komposisi Aktual</span>
                <h2>Jenis Kendaraan</h2>
                <p>Komposisi berdasarkan tahun aktual terbaru.</p>
              </div>
            </div>
            <CompositionBars data={dataKomposisi} />
          </article>

          <article className="panel">
            <div className="panel-header compact-header">
              <div>
                <span className="section-label">Top Forecast</span>
                <h2>Provinsi Tertinggi {ringkasan.tahunPrediksi || ""}</h2>
                <p>Berdasarkan total kendaraan hasil prediksi.</p>
              </div>
            </div>

            <div className="rank-list">
              {topProvinsiPrediksi.map((item, index) => (
                <div className="rank-item" key={item.id}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{item.provinsi}</strong>
                    <small>
                      {formatCompact(item.total_kendaraan)} kendaraan
                    </small>
                  </div>
                </div>
              ))}
              {!topProvinsiPrediksi.length && (
                <div className="empty-state compact">
                  Belum ada data prediksi.
                </div>
              )}
            </div>
          </article>
        </section>

        <section className="panel" id="data">
          <div className="panel-header">
            <div>
              <span className="section-label">Database Kendaraan</span>
              <h2>Data Aktual dan Prediksi</h2>
              <p>Data dari tabel kendaraan_aktual dan prediksi_kendaraan.</p>
            </div>
            <div className="table-count">
              {formatAngka(dataGabungan.length)} baris
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Provinsi</th>
                  <th>Tahun</th>
                  <th>Status</th>
                  <th>Nilai Dipilih</th>
                  <th>Mobil Penumpang</th>
                  <th>Bus</th>
                  <th>Truk</th>
                  <th>Sepeda Motor</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {dataGabungan.map((item) => (
                  <tr key={`${item.sumber}-${item.id}`}>
                    <td>
                      <strong>{item.provinsi}</strong>
                    </td>
                    <td>{item.tahun}</td>
                    <td>
                      <span className={`badge ${item.sumber.toLowerCase()}`}>
                        {item.sumber}
                      </span>
                    </td>
                    <td>{formatAngka(item[filterJenis])}</td>
                    <td>{formatAngka(item.mobil_penumpang)}</td>
                    <td>{formatAngka(item.bus)}</td>
                    <td>{formatAngka(item.truk)}</td>
                    <td>{formatAngka(item.sepeda_motor)}</td>
                    <td>{formatAngka(item.total_kendaraan)}</td>
                  </tr>
                ))}
                {!loading && !dataGabungan.length && (
                  <tr>
                    <td colSpan="9" className="empty-cell">
                      Data tidak ditemukan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="content-grid two-column" id="evaluasi">
          <article className="panel">
            <div className="panel-header compact-header">
              <div>
                <span className="section-label">Evaluasi Model</span>
                <h2>Performa LSTM</h2>
                <p>MAE, RMSE, dan MAPE berdasarkan jenis kendaraan.</p>
              </div>
            </div>

            <div className="eval-grid">
              {evaluasi.map((item) => (
                <div className="eval-card" key={item.id}>
                  <span>{normalisasiNamaKolom(item.jenis_kendaraan)}</span>
                  <strong>{formatPersen(item.mape)}</strong>
                  <small>MAPE</small>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header compact-header">
              <div>
                <span className="section-label">Tabel Evaluasi</span>
                <h2>Detail Error</h2>
              </div>
            </div>

            <div className="table-wrap mini-table">
              <table>
                <thead>
                  <tr>
                    <th>Jenis</th>
                    <th>MAE</th>
                    <th>RMSE</th>
                    <th>MAPE</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluasi.map((item) => (
                    <tr key={item.id}>
                      <td>{normalisasiNamaKolom(item.jenis_kendaraan)}</td>
                      <td>{formatCompact(item.mae)}</td>
                      <td>{formatCompact(item.rmse)}</td>
                      <td>{formatPersen(item.mape)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        <section className="panel input-panel" id="input">
          <div className="panel-header">
            <div>
              <span className="section-label">Input Data</span>
              <h2>Tambah Data Aktual</h2>
              <p>
                Data yang disimpan akan masuk ke tabel kendaraan_aktual. Total
                kendaraan dihitung otomatis dari empat jenis kendaraan.
              </p>
            </div>
          </div>

          <form className="form-grid" onSubmit={simpanDataAktual}>
            <label>
              Provinsi
              <input
                name="provinsi"
                value={form.provinsi}
                onChange={handleInputChange}
                placeholder="Contoh: Riau"
                required
              />
            </label>

            <label>
              Tahun
              <input
                name="tahun"
                type="number"
                min="2000"
                value={form.tahun}
                onChange={handleInputChange}
                placeholder="Contoh: 2026"
                required
              />
            </label>

            {kolomKendaraan
              .filter((kolom) => kolom !== "total_kendaraan")
              .map((kolom) => (
                <label key={kolom}>
                  {normalisasiNamaKolom(kolom)}
                  <input
                    name={kolom}
                    type="number"
                    min="0"
                    value={form[kolom]}
                    onChange={handleInputChange}
                    placeholder="0"
                  />
                </label>
              ))}

            <div className="calculated-total">
              <span>Total Otomatis</span>
              <strong>
                {formatAngka(
                  Number(form.mobil_penumpang || 0) +
                    Number(form.bus || 0) +
                    Number(form.truk || 0) +
                    Number(form.sepeda_motor || 0),
                )}
              </strong>
            </div>

            <button type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan ke Supabase"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

export default App;
