/* eslint-disable react/prop-types */
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

const kolomInputKendaraan = [
  { name: "mobil_penumpang", label: "Mobil Penumpang" },
  { name: "bus", label: "Bus" },
  { name: "truk", label: "Truk" },
  { name: "sepeda_motor", label: "Sepeda Motor" },
];

const halamanList = [
  { id: "dashboard", label: "Dashboard" },
  { id: "forecasting", label: "Forecasting" },
  { id: "data", label: "Data" },
  { id: "evaluasi", label: "Evaluasi" },
  { id: "input", label: "Input" },
  { id: "tentang", label: "Tentang" },
];

function formatAngka(nilai) {
  const angka = Number(nilai || 0);
  return angka.toLocaleString("id-ID");
}

function formatCompact(nilai) {
  const angka = Number(nilai || 0);

  if (!Number.isFinite(angka)) return "0";

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

  if (!Number.isFinite(angka)) {
    return "0,00%";
  }

  return `${angka.toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function labelJenis(nilai) {
  const cocok = jenisKendaraanList.find((item) => item.value === nilai);

  if (cocok) {
    return cocok.label;
  }

  return String(nilai || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (huruf) => huruf.toUpperCase());
}

function angkaInput(nilai) {
  const angka = Number(nilai || 0);
  return Number.isFinite(angka) ? angka : 0;
}

function buatPayloadKendaraan(form, status) {
  const mobilPenumpang = Math.round(angkaInput(form.mobil_penumpang));
  const bus = Math.round(angkaInput(form.bus));
  const truk = Math.round(angkaInput(form.truk));
  const sepedaMotor = Math.round(angkaInput(form.sepeda_motor));

  return {
    provinsi: String(form.provinsi || "").trim(),
    tahun: Math.round(angkaInput(form.tahun)),
    status,
    mobil_penumpang: mobilPenumpang,
    bus,
    truk,
    sepeda_motor: sepedaMotor,
    total_kendaraan: mobilPenumpang + bus + truk + sepedaMotor,
  };
}

function totalPerTahun(data, kolom) {
  const map = new Map();

  data.forEach((item) => {
    const tahun = Number(item.tahun);
    const nilai = Number(item[kolom] || 0);

    if (Number.isFinite(tahun)) {
      map.set(tahun, (map.get(tahun) || 0) + nilai);
    }
  });

  return Array.from(map, ([tahun, nilai]) => ({ tahun, nilai })).sort(
    (a, b) => a.tahun - b.tahun,
  );
}

function totalKendaraanForm(form) {
  return kolomInputKendaraan.reduce(
    (total, kolom) => total + angkaInput(form[kolom.name]),
    0,
  );
}

function ambilNilaiMaksimal(series) {
  const semuaNilai = series.flatMap((item) =>
    item.data.map((data) => Number(data.nilai || 0)),
  );

  return Math.max(...semuaNilai, 1);
}

function gabungPerProvinsi(data, kolom = "total_kendaraan") {
  const map = new Map();

  data.forEach((item) => {
    const provinsi = item.provinsi || "Tidak diketahui";
    const nilai = Number(item[kolom] || 0);
    map.set(provinsi, (map.get(provinsi) || 0) + nilai);
  });

  return Array.from(map, ([provinsi, nilai]) => ({ provinsi, nilai })).sort(
    (a, b) => b.nilai - a.nilai,
  );
}

function agregasiKendaraan(data) {
  return data.reduce(
    (hasil, item) => {
      kolomInputKendaraan.forEach((kolom) => {
        hasil[kolom.name] += Number(item[kolom.name] || 0);
      });

      hasil.total_kendaraan += Number(item.total_kendaraan || 0);
      return hasil;
    },
    {
      mobil_penumpang: 0,
      bus: 0,
      truk: 0,
      sepeda_motor: 0,
      total_kendaraan: 0,
    },
  );
}

function TrendChart({ aktual, prediksi }) {
  const width = 980;
  const height = 340;
  const paddingX = 58;
  const paddingY = 44;

  const semuaTahun = [...aktual, ...prediksi]
    .map((item) => Number(item.tahun))
    .filter(Number.isFinite);

  const tahunSekarang = new Date().getFullYear();
  const minTahun = Math.min(...semuaTahun, tahunSekarang);
  const maxTahun = Math.max(...semuaTahun, tahunSekarang);
  const maxNilai = ambilNilaiMaksimal([
    { label: "Aktual", data: aktual },
    { label: "Prediksi", data: prediksi },
  ]);

  function getX(tahun) {
    if (minTahun === maxTahun) {
      return width / 2;
    }

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
    return (
      <div className="empty-state">
        Belum ada data untuk grafik. Pastikan data Supabase sudah terisi.
      </div>
    );
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
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="areaPrediksi" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
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
                r="4.5"
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
                r="4.5"
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
  const total = kolomInputKendaraan.reduce(
    (sum, item) => sum + Number(data?.[item.name] || 0),
    0,
  );

  if (!data || total === 0) {
    return (
      <div className="empty-state compact">
        Belum ada komposisi kendaraan untuk filter ini.
      </div>
    );
  }

  return (
    <div className="bar-list">
      {kolomInputKendaraan.map((item) => {
        const nilai = Number(data[item.name] || 0);
        const persen = total ? (nilai / total) * 100 : 0;

        return (
          <div className="bar-item" key={item.name}>
            <div className="bar-info">
              <span>{item.label}</span>
              <strong>{formatCompact(nilai)}</strong>
            </div>
            <div className="bar-track">
              <div
                className={`bar-fill ${item.name}`}
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
  const [halamanAktif, setHalamanAktif] = useState("dashboard");
  const [dataAktual, setDataAktual] = useState([]);
  const [dataPrediksi, setDataPrediksi] = useState([]);
  const [evaluasi, setEvaluasi] = useState([]);

  const [loading, setLoading] = useState(true);
  const [savingAktual, setSavingAktual] = useState(false);
  const [savingPrediksi, setSavingPrediksi] = useState(false);
  const [pesan, setPesan] = useState("");
  const [error, setError] = useState("");

  const [filterProvinsi, setFilterProvinsi] = useState("Semua");
  const [filterJenis, setFilterJenis] = useState("total_kendaraan");
  const [filterStatus, setFilterStatus] = useState("Semua");
  const [pencarian, setPencarian] = useState("");
  const [growthPrediksi, setGrowthPrediksi] = useState(5);

  const [formAktual, setFormAktual] = useState({
    provinsi: "",
    tahun: "",
    mobil_penumpang: "",
    bus: "",
    truk: "",
    sepeda_motor: "",
  });

  const [formPrediksi, setFormPrediksi] = useState({
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
      const keyword = pencarian.toLowerCase();
      gabungan = gabungan.filter((item) =>
        `${item.provinsi} ${item.tahun} ${item.status} ${item.sumber}`
          .toLowerCase()
          .includes(keyword),
      );
    }

    return gabungan.sort((a, b) => {
      const provinsi = String(a.provinsi).localeCompare(String(b.provinsi));
      if (provinsi !== 0) return provinsi;
      return Number(a.tahun) - Number(b.tahun);
    });
  }, [dataAktual, dataPrediksi, filterProvinsi, filterStatus, pencarian]);

  const dataAktualFilter = useMemo(() => {
    if (filterProvinsi === "Semua") {
      return dataAktual;
    }

    return dataAktual.filter((item) => item.provinsi === filterProvinsi);
  }, [dataAktual, filterProvinsi]);

  const dataPrediksiFilter = useMemo(() => {
    if (filterProvinsi === "Semua") {
      return dataPrediksi;
    }

    return dataPrediksi.filter((item) => item.provinsi === filterProvinsi);
  }, [dataPrediksi, filterProvinsi]);

  const chartAktual = useMemo(
    () => totalPerTahun(dataAktualFilter, filterJenis),
    [dataAktualFilter, filterJenis],
  );

  const chartPrediksi = useMemo(
    () => totalPerTahun(dataPrediksiFilter, filterJenis),
    [dataPrediksiFilter, filterJenis],
  );

  const tahunAktualTerakhir = useMemo(() => {
    const tahun = dataAktual
      .map((item) => Number(item.tahun))
      .filter(Number.isFinite);
    return tahun.length ? Math.max(...tahun) : null;
  }, [dataAktual]);

  const tahunPrediksiTerakhir = useMemo(() => {
    const tahun = dataPrediksi
      .map((item) => Number(item.tahun))
      .filter(Number.isFinite);
    return tahun.length ? Math.max(...tahun) : null;
  }, [dataPrediksi]);

  const ringkasan = useMemo(() => {
    const totalAktual = dataAktual.reduce(
      (total, item) => total + Number(item.total_kendaraan || 0),
      0,
    );

    const totalPrediksi = dataPrediksi.reduce(
      (total, item) => total + Number(item.total_kendaraan || 0),
      0,
    );

    const jumlahProvinsi = new Set(dataAktual.map((item) => item.provinsi))
      .size;
    const rataMape = evaluasi.length
      ? evaluasi.reduce((sum, item) => sum + Number(item.mape || 0), 0) /
        evaluasi.length
      : 0;

    return {
      totalAktual,
      totalPrediksi,
      jumlahAktual: dataAktual.length,
      jumlahPrediksi: dataPrediksi.length,
      jumlahProvinsi,
      rataMape,
    };
  }, [dataAktual, dataPrediksi, evaluasi]);

  const dataKomposisi = useMemo(() => {
    let sumber = dataAktualFilter;

    if (tahunAktualTerakhir) {
      sumber = sumber.filter(
        (item) => Number(item.tahun) === tahunAktualTerakhir,
      );
    }

    if (filterProvinsi !== "Semua") {
      sumber = sumber.filter((item) => item.provinsi === filterProvinsi);
    }

    return agregasiKendaraan(sumber);
  }, [dataAktualFilter, tahunAktualTerakhir, filterProvinsi]);

  const topProvinsiPrediksi = useMemo(() => {
    let sumber = dataPrediksi;

    if (tahunPrediksiTerakhir) {
      sumber = sumber.filter(
        (item) => Number(item.tahun) === tahunPrediksiTerakhir,
      );
    }

    return gabungPerProvinsi(sumber, filterJenis).slice(0, 6);
  }, [dataPrediksi, tahunPrediksiTerakhir, filterJenis]);

  const evaluasiTerurut = useMemo(() => {
    return [...evaluasi].sort(
      (a, b) => Number(a.mape || 0) - Number(b.mape || 0),
    );
  }, [evaluasi]);

  const totalFormAktual = useMemo(
    () => totalKendaraanForm(formAktual),
    [formAktual],
  );

  const totalFormPrediksi = useMemo(
    () => totalKendaraanForm(formPrediksi),
    [formPrediksi],
  );

  function handleFormAktualChange(event) {
    const { name, value } = event.target;
    setFormAktual((prev) => ({ ...prev, [name]: value }));
  }

  function handleFormPrediksiChange(event) {
    const { name, value } = event.target;
    setFormPrediksi((prev) => ({ ...prev, [name]: value }));
  }

  function isiPrediksiDariAktualTerakhir() {
    const provinsiDipilih = formPrediksi.provinsi || filterProvinsi;

    if (!provinsiDipilih || provinsiDipilih === "Semua") {
      setError(
        "Pilih provinsi terlebih dahulu sebelum membuat prediksi cepat.",
      );
      setPesan("");
      return;
    }

    const dataProvinsi = dataAktual
      .filter((item) => item.provinsi === provinsiDipilih)
      .sort((a, b) => Number(b.tahun) - Number(a.tahun));

    if (!dataProvinsi.length) {
      setError("Data aktual provinsi tersebut belum tersedia.");
      setPesan("");
      return;
    }

    const dataTerakhir = dataProvinsi[0];
    const faktor = 1 + angkaInput(growthPrediksi) / 100;

    setFormPrediksi({
      provinsi: provinsiDipilih,
      tahun: Number(dataTerakhir.tahun || 0) + 1,
      mobil_penumpang: Math.round(
        Number(dataTerakhir.mobil_penumpang || 0) * faktor,
      ),
      bus: Math.round(Number(dataTerakhir.bus || 0) * faktor),
      truk: Math.round(Number(dataTerakhir.truk || 0) * faktor),
      sepeda_motor: Math.round(Number(dataTerakhir.sepeda_motor || 0) * faktor),
    });

    setPesan("Prediksi cepat berhasil dihitung dari data aktual terakhir.");
    setError("");
  }

  async function simpanDataAktual(event) {
    event.preventDefault();
    setSavingAktual(true);
    setPesan("");
    setError("");

    const payload = buatPayloadKendaraan(formAktual, "Aktual");

    if (!payload.provinsi || !payload.tahun) {
      setError("Provinsi dan tahun wajib diisi.");
      setSavingAktual(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("kendaraan_aktual")
      .insert(payload);

    if (insertError) {
      setError(
        "Gagal menyimpan data aktual. Periksa policy INSERT tabel kendaraan_aktual.",
      );
      console.error(insertError);
      setSavingAktual(false);
      return;
    }

    setPesan("Data aktual berhasil disimpan.");
    setFormAktual({
      provinsi: "",
      tahun: "",
      mobil_penumpang: "",
      bus: "",
      truk: "",
      sepeda_motor: "",
    });
    await ambilData();
    setSavingAktual(false);
  }

  async function simpanDataPrediksi(event) {
    event.preventDefault();
    setSavingPrediksi(true);
    setPesan("");
    setError("");

    const payload = buatPayloadKendaraan(formPrediksi, "Prediksi");

    if (!payload.provinsi || !payload.tahun) {
      setError("Provinsi dan tahun prediksi wajib diisi.");
      setSavingPrediksi(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("prediksi_kendaraan")
      .insert(payload);

    if (insertError) {
      setError(
        "Gagal menyimpan data prediksi. Periksa policy INSERT tabel prediksi_kendaraan.",
      );
      console.error(insertError);
      setSavingPrediksi(false);
      return;
    }

    setPesan("Data prediksi berhasil disimpan.");
    setFormPrediksi({
      provinsi: "",
      tahun: "",
      mobil_penumpang: "",
      bus: "",
      truk: "",
      sepeda_motor: "",
    });
    await ambilData();
    setSavingPrediksi(false);
  }

  function pindahHalaman(id) {
    setHalamanAktif(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const namaFilterJenis = labelJenis(filterJenis);

  function ToolbarFilter() {
    return (
      <section className="toolbar" aria-label="Filter data">
        <label>
          Provinsi
          <select
            value={filterProvinsi}
            onChange={(event) => setFilterProvinsi(event.target.value)}
          >
            {daftarProvinsi.map((provinsi) => (
              <option key={provinsi} value={provinsi}>
                {provinsi}
              </option>
            ))}
          </select>
        </label>

        <label>
          Jenis Kendaraan
          <select
            value={filterJenis}
            onChange={(event) => setFilterJenis(event.target.value)}
          >
            {jenisKendaraanList.map((jenis) => (
              <option key={jenis.value} value={jenis.value}>
                {jenis.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Status
          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
          >
            <option value="Semua">Semua</option>
            <option value="Aktual">Aktual</option>
            <option value="Prediksi">Prediksi</option>
          </select>
        </label>

        <label>
          Cari Data
          <input
            value={pencarian}
            onChange={(event) => setPencarian(event.target.value)}
            placeholder="Cari provinsi, tahun, atau status..."
          />
        </label>
      </section>
    );
  }

  function StatGrid() {
    return (
      <section className="stat-grid" aria-label="Ringkasan data">
        <div className="stat-card blue">
          <span>Total Aktual</span>
          <strong>{formatCompact(ringkasan.totalAktual)}</strong>
          <p>{formatAngka(ringkasan.jumlahAktual)} baris data aktual</p>
        </div>

        <div className="stat-card amber">
          <span>Total Prediksi</span>
          <strong>{formatCompact(ringkasan.totalPrediksi)}</strong>
          <p>{formatAngka(ringkasan.jumlahPrediksi)} baris data prediksi</p>
        </div>

        <div className="stat-card green">
          <span>Provinsi</span>
          <strong>{formatAngka(ringkasan.jumlahProvinsi)}</strong>
          <p>Wilayah pada data aktual</p>
        </div>

        <div className="stat-card purple">
          <span>Rata-rata MAPE</span>
          <strong>{formatPersen(ringkasan.rataMape)}</strong>
          <p>Evaluasi model LSTM</p>
        </div>
      </section>
    );
  }

  function TabelData({ data, limit }) {
    const dataTampil = limit ? data.slice(0, limit) : data;

    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Provinsi</th>
              <th>Tahun</th>
              <th>Status</th>
              <th>Jenis Data</th>
              <th>{namaFilterJenis}</th>
              <th>Mobil</th>
              <th>Bus</th>
              <th>Truk</th>
              <th>Motor</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {dataTampil.map((item) => (
              <tr key={`${item.sumber}-${item.id}`}>
                <td>{item.provinsi}</td>
                <td>{item.tahun}</td>
                <td>{item.status}</td>
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

            {!dataTampil.length && (
              <tr>
                <td colSpan="10" className="empty-cell">
                  Data tidak ditemukan untuk filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  function HalamanDashboard() {
    return (
      <>
        <section className="hero-section">
          <div className="hero-copy">
            <span className="eyebrow">LSTM Forecasting Dashboard</span>
            <h1>Dashboard prediksi volume kendaraan Indonesia.</h1>
            <p>
              Pantau data aktual, hasil forecasting, evaluasi model, dan input
              skenario prediksi dalam satu dashboard yang terhubung langsung ke
              Supabase.
            </p>
            <div className="hero-actions">
              <button
                type="button"
                onClick={() => pindahHalaman("forecasting")}
              >
                Lihat Forecasting
              </button>
              <button
                type="button"
                className="button-soft"
                onClick={() => pindahHalaman("input")}
              >
                Input Data
              </button>
            </div>
          </div>

          <div className="hero-panel">
            <span>Tahun prediksi terakhir</span>
            <strong>{tahunPrediksiTerakhir || "-"}</strong>
            <p>
              Fokus utama dashboard adalah membandingkan data aktual dengan data
              prediksi kendaraan.
            </p>
          </div>
        </section>

        <ToolbarFilter />
        <StatGrid />

        <section className="content-grid">
          <div className="panel chart-panel">
            <div className="panel-header">
              <div>
                <span className="section-label">Tren Utama</span>
                <h2>Aktual vs Prediksi</h2>
                <p>
                  Grafik menampilkan {namaFilterJenis.toLowerCase()} berdasarkan
                  filter provinsi yang dipilih.
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
              <TrendChart aktual={chartAktual} prediksi={chartPrediksi} />
            )}
          </div>

          <div className="panel">
            <div className="panel-header compact-header">
              <div>
                <span className="section-label">Komposisi</span>
                <h2>Jenis Kendaraan</h2>
                <p>Komposisi data aktual tahun terakhir.</p>
              </div>
            </div>
            <CompositionBars data={dataKomposisi} />
          </div>
        </section>

        <section className="content-grid two-column">
          <div className="panel">
            <div className="panel-header compact-header">
              <div>
                <span className="section-label">Top Prediksi</span>
                <h2>Provinsi Tertinggi</h2>
                <p>
                  Berdasarkan {namaFilterJenis.toLowerCase()} tahun{" "}
                  {tahunPrediksiTerakhir || "prediksi"}.
                </p>
              </div>
            </div>

            <div className="rank-list">
              {topProvinsiPrediksi.map((item, index) => (
                <div className="rank-item" key={item.provinsi}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{item.provinsi}</strong>
                    <small>{formatAngka(item.nilai)} kendaraan</small>
                  </div>
                </div>
              ))}

              {!topProvinsiPrediksi.length && (
                <div className="empty-state compact">
                  Data prediksi belum ada.
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header compact-header">
              <div>
                <span className="section-label">Evaluasi Cepat</span>
                <h2>Kualitas Model</h2>
                <p>Diurutkan berdasarkan MAPE paling kecil.</p>
              </div>
            </div>

            <div className="eval-list">
              {evaluasiTerurut.slice(0, 4).map((item) => (
                <div className="eval-row" key={item.id}>
                  <div>
                    <strong>{labelJenis(item.jenis_kendaraan)}</strong>
                    <small>MAE {formatCompact(item.mae)}</small>
                  </div>
                  <span>{formatPersen(item.mape)}</span>
                </div>
              ))}

              {!evaluasiTerurut.length && (
                <div className="empty-state compact">
                  Evaluasi belum tersedia.
                </div>
              )}
            </div>
          </div>
        </section>
      </>
    );
  }

  function HalamanForecasting() {
    return (
      <>
        <section className="page-heading">
          <span className="eyebrow">Halaman Forecasting</span>
          <h1>Analisis hasil prediksi kendaraan.</h1>
          <p>
            Gunakan filter untuk melihat tren prediksi per provinsi dan per
            jenis kendaraan.
          </p>
        </section>

        <ToolbarFilter />

        <section className="panel chart-panel full">
          <div className="panel-header">
            <div>
              <span className="section-label">Grafik Forecasting</span>
              <h2>{namaFilterJenis}</h2>
              <p>
                Membandingkan data aktual historis dengan data prediksi masa
                depan.
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
          <TrendChart aktual={chartAktual} prediksi={chartPrediksi} />
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="section-label">Tabel Forecasting</span>
              <h2>Data Aktual dan Prediksi</h2>
              <p>Data yang tampil mengikuti filter di atas.</p>
            </div>
            <div className="table-count">
              {formatAngka(dataGabungan.length)} data
            </div>
          </div>
          <TabelData data={dataGabungan} />
        </section>
      </>
    );
  }

  function HalamanData() {
    return (
      <>
        <section className="page-heading">
          <span className="eyebrow">Halaman Data</span>
          <h1>Dataset kendaraan aktual dan prediksi.</h1>
          <p>
            Halaman ini membantu pengecekan data yang sudah masuk ke Supabase.
          </p>
        </section>

        <ToolbarFilter />

        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="section-label">Data Supabase</span>
              <h2>Daftar Kendaraan</h2>
              <p>
                Tabel berisi gabungan data dari kendaraan_aktual dan
                prediksi_kendaraan.
              </p>
            </div>
            <button type="button" className="button-soft" onClick={ambilData}>
              Refresh Data
            </button>
          </div>
          <TabelData data={dataGabungan} />
        </section>
      </>
    );
  }

  function HalamanEvaluasi() {
    return (
      <>
        <section className="page-heading">
          <span className="eyebrow">Halaman Evaluasi</span>
          <h1>Evaluasi model LSTM.</h1>
          <p>
            Perhatikan nilai MAE, RMSE, dan MAPE untuk membaca performa model.
          </p>
        </section>

        <section className="eval-grid">
          {evaluasiTerurut.map((item) => (
            <div className="eval-card" key={item.id}>
              <span>{labelJenis(item.jenis_kendaraan)}</span>
              <strong>{formatPersen(item.mape)}</strong>
              <small>MAPE</small>
              <div className="metric-line">
                <p>
                  <b>MAE</b>
                  {formatCompact(item.mae)}
                </p>
                <p>
                  <b>RMSE</b>
                  {formatCompact(item.rmse)}
                </p>
              </div>
            </div>
          ))}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="section-label">Detail Evaluasi</span>
              <h2>Tabel Evaluasi Model</h2>
              <p>Semakin kecil nilai error, semakin baik performa model.</p>
            </div>
          </div>

          <div className="table-wrap mini-table">
            <table>
              <thead>
                <tr>
                  <th>Jenis Kendaraan</th>
                  <th>MAE</th>
                  <th>RMSE</th>
                  <th>MAPE</th>
                </tr>
              </thead>
              <tbody>
                {evaluasiTerurut.map((item) => (
                  <tr key={item.id}>
                    <td>{labelJenis(item.jenis_kendaraan)}</td>
                    <td>{formatAngka(item.mae)}</td>
                    <td>{formatAngka(item.rmse)}</td>
                    <td>{formatPersen(item.mape)}</td>
                  </tr>
                ))}

                {!evaluasiTerurut.length && (
                  <tr>
                    <td colSpan="4" className="empty-cell">
                      Data evaluasi belum tersedia.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function HalamanInput() {
    return (
      <>
        <section className="page-heading">
          <span className="eyebrow">Halaman Input</span>
          <h1>Input data aktual dan skenario prediksi.</h1>
          <p>
            Data aktual masuk ke tabel kendaraan_aktual, sedangkan input
            prediksi masuk ke tabel prediksi_kendaraan.
          </p>
        </section>

        <section className="content-grid two-column input-layout">
          <div className="panel input-panel">
            <div className="panel-header compact-header">
              <div>
                <span className="section-label">Input Aktual</span>
                <h2>Tambah Data Aktual</h2>
                <p>Gunakan untuk menambah data kendaraan historis.</p>
              </div>
            </div>

            <form
              className="form-grid form-vertical"
              onSubmit={simpanDataAktual}
            >
              <label>
                Provinsi
                <input
                  name="provinsi"
                  value={formAktual.provinsi}
                  onChange={handleFormAktualChange}
                  placeholder="Contoh: Riau"
                  required
                />
              </label>

              <label>
                Tahun
                <input
                  name="tahun"
                  type="number"
                  value={formAktual.tahun}
                  onChange={handleFormAktualChange}
                  placeholder="Contoh: 2025"
                  required
                />
              </label>

              {kolomInputKendaraan.map((kolom) => (
                <label key={kolom.name}>
                  {kolom.label}
                  <input
                    name={kolom.name}
                    type="number"
                    min="0"
                    value={formAktual[kolom.name]}
                    onChange={handleFormAktualChange}
                    placeholder="0"
                  />
                </label>
              ))}

              <div className="calculated-total">
                <span>Total Otomatis</span>
                <strong>{formatAngka(totalFormAktual)}</strong>
              </div>

              <button type="submit" disabled={savingAktual}>
                {savingAktual ? "Menyimpan..." : "Simpan Data Aktual"}
              </button>
            </form>
          </div>

          <div className="panel input-panel forecast-input-panel">
            <div className="panel-header compact-header">
              <div>
                <span className="section-label">Input Prediksi</span>
                <h2>Tambah Skenario Prediksi</h2>
                <p>
                  Bisa diisi manual atau dihitung cepat dari data aktual
                  terakhir.
                </p>
              </div>
            </div>

            <div className="quick-predictor">
              <label>
                Pertumbuhan Cepat (%)
                <input
                  type="number"
                  value={growthPrediksi}
                  onChange={(event) => setGrowthPrediksi(event.target.value)}
                  placeholder="5"
                />
              </label>
              <button type="button" onClick={isiPrediksiDariAktualTerakhir}>
                Hitung Dari Aktual Terakhir
              </button>
            </div>

            <form
              className="form-grid form-vertical"
              onSubmit={simpanDataPrediksi}
            >
              <label>
                Provinsi
                <input
                  name="provinsi"
                  value={formPrediksi.provinsi}
                  onChange={handleFormPrediksiChange}
                  placeholder="Contoh: Riau"
                  required
                  list="list-provinsi"
                />
              </label>

              <label>
                Tahun Prediksi
                <input
                  name="tahun"
                  type="number"
                  value={formPrediksi.tahun}
                  onChange={handleFormPrediksiChange}
                  placeholder="Contoh: 2026"
                  required
                />
              </label>

              <datalist id="list-provinsi">
                {daftarProvinsi
                  .filter((provinsi) => provinsi !== "Semua")
                  .map((provinsi) => (
                    <option key={provinsi} value={provinsi} />
                  ))}
              </datalist>

              {kolomInputKendaraan.map((kolom) => (
                <label key={kolom.name}>
                  {kolom.label}
                  <input
                    name={kolom.name}
                    type="number"
                    min="0"
                    value={formPrediksi[kolom.name]}
                    onChange={handleFormPrediksiChange}
                    placeholder="0"
                  />
                </label>
              ))}

              <div className="calculated-total forecast-total">
                <span>Total Prediksi</span>
                <strong>{formatAngka(totalFormPrediksi)}</strong>
              </div>

              <button type="submit" disabled={savingPrediksi}>
                {savingPrediksi ? "Menyimpan..." : "Simpan Data Prediksi"}
              </button>
            </form>
          </div>
        </section>
      </>
    );
  }

  function HalamanTentang() {
    return (
      <>
        <section className="page-heading">
          <span className="eyebrow">Tentang Sistem</span>
          <h1>Cara membaca dashboard forecasting.</h1>
          <p>
            Dashboard ini memisahkan data aktual, data prediksi, dan evaluasi
            model agar alur analisis lebih mudah dipahami.
          </p>
        </section>

        <section className="content-grid two-column">
          <div className="panel info-panel">
            <span className="section-label">Alur Data</span>
            <h2>Dari notebook ke web</h2>
            <ol className="step-list">
              <li>Dataset kendaraan diproses dan dinormalisasi di notebook.</li>
              <li>
                Model LSTM menghasilkan forecasting beberapa tahun ke depan.
              </li>
              <li>Output CSV diimport ke Supabase.</li>
              <li>
                Web membaca data Supabase dan menampilkannya sebagai dashboard.
              </li>
            </ol>
          </div>

          <div className="panel info-panel warm">
            <span className="section-label">Input Prediksi</span>
            <h2>Apakah prediksi bisa ada inputan?</h2>
            <p>
              Bisa. Di web ini sudah ditambahkan halaman Input Prediksi. Namun
              input tersebut adalah skenario/manual forecasting yang disimpan ke
              tabel prediksi_kendaraan. Untuk menjalankan model LSTM asli dari
              input web, perlu backend Python/API yang memuat model hasil
              training.
            </p>
          </div>
        </section>
      </>
    );
  }

  function renderHalaman() {
    if (halamanAktif === "forecasting") return <HalamanForecasting />;
    if (halamanAktif === "data") return <HalamanData />;
    if (halamanAktif === "evaluasi") return <HalamanEvaluasi />;
    if (halamanAktif === "input") return <HalamanInput />;
    if (halamanAktif === "tentang") return <HalamanTentang />;
    return <HalamanDashboard />;
  }

  return (
    <div className="app-shell">
      <nav className="top-navbar">
        <button
          type="button"
          className="brand-button"
          onClick={() => pindahHalaman("dashboard")}
        >
          <span className="brand-mark">FK</span>
          <span>
            <strong>Forecasting Kendaraan</strong>
            <small>LSTM Dashboard</small>
          </span>
        </button>

        <div className="navbar-links" aria-label="Navigasi utama">
          {halamanList.map((item) => (
            <button
              type="button"
              key={item.id}
              className={halamanAktif === item.id ? "active" : ""}
              onClick={() => pindahHalaman(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button type="button" className="refresh-button" onClick={ambilData}>
          Refresh
        </button>
      </nav>

      <main className="main-content">
        {pesan && <div className="message success">{pesan}</div>}
        {error && <div className="message error">{error}</div>}
        {loading && (
          <div className="message info">Memuat data dari Supabase...</div>
        )}
        {renderHalaman()}
      </main>
    </div>
  );
}

export default App;
