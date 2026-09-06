/* ============================================================
   ASTA — Dasbor Teknis (Prostetis)
   Kondisi seluruh lengan bionik, peringatan socket, mutu
   sinyal EMG, dan jadwal servis.
   ============================================================ */
(function () {
  'use strict';

  Seed.run();
  var user = Auth.guard('prostetis');
  if (!user) return;

  var shell = Shell.mount({
    title: 'Dasbor Teknis',
    desc: 'Kondisi perangkat, mutu sinyal, dan jadwal servis'
  });
  if (!shell) return;
  var c = shell.content;

  var devices = Store.list('devices');
  var patients = Store.list('users').filter(function (u) { return u.role === 'pasien'; });

  /* ---------------- Bangun kondisi tiap perangkat ---------------- */
  var fleet = devices.map(function (d) {
    var p = Store.find('users', d.patientId);
    var usage7 = Analytics.usageStats(d.patientId, 7);
    var usage30 = Analytics.usageStats(d.patientId, 30);
    var daysToService = U.daysBetween(new Date(), U.d(d.nextService));
    var aeDevice = Study.adverseEvents(d.patientId).filter(function (a) {
      return ['alat', 'socket', 'haptik'].indexOf(a.relatedTo) >= 0;
    });

    var alerts = [];
    if (usage7.emgQuality && usage7.emgQuality < 65) {
      alerts.push({ tone: 'danger', text: 'Mutu sinyal EMG ' + usage7.emgQuality +
        '%. Elektroda kemungkinan bergeser atau kotor.' });
    }
    if (usage7.socketHumidity >= 62) {
      alerts.push({ tone: 'warning', text: 'Kelembapan socket ' + usage7.socketHumidity +
        '%. Risiko iritasi kulit, pertimbangkan liner berventilasi.' });
    }
    if (usage7.socketTemp >= 36) {
      alerts.push({ tone: 'warning', text: 'Suhu socket ' + usage7.socketTemp +
        ' °C di atas nyaman.' });
    }
    if (daysToService <= 7) {
      alerts.push({ tone: daysToService <= 0 ? 'danger' : 'warning',
        text: daysToService <= 0 ? 'Servis berkala terlewat ' + Math.abs(daysToService) + ' hari.'
          : 'Servis berkala dalam ' + daysToService + ' hari.' });
    }
    if (d.batteryHealth < 85) {
      alerts.push({ tone: 'warning', text: 'Kesehatan baterai ' + d.batteryHealth +
        '%. Pertimbangkan penggantian.' });
    }
    if (usage7.recalibrations >= 3) {
      alerts.push({ tone: 'warning', text: usage7.recalibrations +
        ' kali re-kalibrasi dalam seminggu. Sinyal tidak stabil.' });
    }
    if (usage30.wearAvg < 2) {
      alerts.push({ tone: 'warning', text: 'Alat hanya dipakai ' + usage30.wearAvg +
        ' jam/hari. Periksa kenyamanan fit.' });
    }
    if (aeDevice.filter(function (a) { return a.status !== 'selesai'; }).length) {
      alerts.push({ tone: 'danger', text: 'Ada laporan kejadian terkait alat yang belum ditangani.' });
    }

    return {
      dev: d, patient: p, usage7: usage7, usage30: usage30,
      daysToService: daysToService, alerts: alerts, aeDevice: aeDevice,
      health: alerts.some(function (a) { return a.tone === 'danger'; }) ? 'kritis'
        : alerts.length ? 'perhatian' : 'baik'
    };
  }).sort(function (a, b) {
    var rank = { kritis: 0, perhatian: 1, baik: 2 };
    return rank[a.health] - rank[b.health];
  });

  var needAttn = fleet.filter(function (f) { return f.health !== 'baik'; });
  var totalCycles = U.sum(devices.map(function (d) { return d.actuatorCycles; }));
  var avgEmg = Math.round(U.avg(fleet.map(function (f) { return f.usage7.emgQuality || 0; })));
  var dueSoon = fleet.filter(function (f) { return f.daysToService <= 14; }).length;

  c.innerHTML =
    '<section class="grid g4">' +
    UI.statCard({ label: 'Perangkat aktif', value: devices.length, icon: 'cpu',
      hint: needAttn.length + ' perlu perhatian' }) +
    UI.statCard({ label: 'Mutu EMG rata-rata', value: avgEmg, unit: '%', icon: 'pulse',
      tone: avgEmg >= 80 ? 'success' : avgEmg >= 65 ? 'warning' : 'danger', hint: '7 hari' }) +
    UI.statCard({ label: 'Servis dalam 14 hari', value: dueSoon, unit: 'unit', icon: 'wrench',
      tone: dueSoon ? 'warning' : 'success' }) +
    UI.statCard({ label: 'Total siklus aktuator', value: U.nf(totalCycles), icon: 'refresh',
      hint: 'seluruh armada' }) +
    '</section>' +

    (needAttn.length
      ? '<section class="card">' +
        '<div class="card-head"><div><div class="card-title">Perlu tindakan teknis</div>' +
        '<div class="card-sub">Diurutkan dari yang paling kritis</div></div>' +
        '<span class="badge badge-warning">' + needAttn.length + ' unit</span></div>' +
        '<div class="col gap-3">' +
        needAttn.map(function (f) {
          return '<div class="card flat" style="border-left:4px solid var(--' +
            (f.health === 'kritis' ? 'danger' : 'warning') + ')">' +
            '<div class="row between wrap gap-3 mb-3">' +
            '<div class="row gap-3">' +
            '<span class="stat-ico ' + (f.health === 'kritis' ? 'danger' : 'warning') +
            '" style="width:42px;height:42px">' + Icon('cpu', 20) + '</span>' +
            '<div><span class="semi mono t-sm">' + U.esc(f.dev.serial) + '</span>' +
            '<div class="t-xs muted">' + U.esc(f.patient ? f.patient.name : '-') + ' · ' +
            U.esc(f.dev.model) + '</div></div></div>' +
            '<div class="row gap-2">' +
            '<a class="btn btn-sm" href="perangkat.html">' + Icon('eye', 15) + '<span>Monitor</span></a>' +
            '<a class="btn btn-sm btn-primary" href="kalibrasi.html">' + Icon('sliders', 15) +
            '<span>Kalibrasi</span></a></div></div>' +
            '<div class="col gap-2">' +
            f.alerts.map(function (a) {
              return '<div class="alert ' + a.tone + '"><span class="a-ico">' + Icon('alert', 16) + '</span>' +
                '<span class="t-xs">' + U.esc(a.text) + '</span></div>';
            }).join('') + '</div></div>';
        }).join('') + '</div></section>'
      : '<div class="alert success"><span class="a-ico">' + Icon('checkCircle', 18) + '</span>' +
        '<span class="t-sm">Semua perangkat dalam kondisi baik.</span></div>') +

    /* ===== Tabel armada ===== */
    '<section class="card">' +
    '<div class="card-head"><div><div class="card-title">Armada perangkat</div>' +
    '<div class="card-sub">Data telemetri 7 hari terakhir</div></div>' +
    '<button class="btn btn-sm" id="btn-export">' + Icon('download', 15) + '<span>Ekspor</span></button>' +
    '</div>' +
    '<div class="table-wrap"><table class="table"><thead><tr>' +
    '<th>Nomor seri</th><th>Pasien</th><th>Firmware</th><th>Pakai/hari</th>' +
    '<th>Mutu EMG</th><th>Grip sukses</th><th>Suhu</th><th>Kelembapan</th>' +
    '<th>Re-kal</th><th>Siklus</th><th>Baterai</th><th>Servis</th><th>Kondisi</th>' +
    '</tr></thead><tbody id="fleet-table"></tbody></table></div>' +
    '</section>' +

    /* ===== Grafik ===== */
    '<section class="grid g2">' +
    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Mutu sinyal EMG per pasien</div>' +
    '<div class="card-sub">30 hari. Penurunan menandakan masalah elektroda atau socket.</div></div></div>' +
    '<div class="chart-box"><canvas id="ch-emg" data-height="250"></canvas></div>' +
    '<div class="chart-legend mt-3" id="emg-legend"></div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Kondisi lingkungan socket</div>' +
    '<div class="card-sub">Suhu dan kelembapan rata-rata 30 hari</div></div></div>' +
    '<div class="chart-box"><canvas id="ch-env" data-height="250"></canvas></div>' +
    '<div class="chart-legend mt-3">' +
    '<span><i style="background:#d98b0b"></i>Suhu (°C)</span>' +
    '<span><i style="background:#10a5a5"></i>Kelembapan (%)</span></div>' +
    '<p class="t-xs muted mt-3">Kelembapan di atas 60% berkaitan dengan iritasi kulit dan ' +
    'penurunan mutu sinyal karena elektroda tergeser.</p>' +
    '</div></section>' +

    /* ===== Jadwal servis & kejadian ===== */
    '<section class="grid g-2-1">' +
    '<div class="card">' +
    '<div class="card-head"><div class="card-title">Jadwal servis</div></div>' +
    '<div class="col gap-3" id="service-list"></div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Kejadian terkait alat</div>' +
    '<div class="card-sub">Laporan pasien mengenai socket, aktuator, dan haptik</div></div></div>' +
    '<div class="col gap-3" id="ae-list"></div>' +
    '</div></section>';

  /* ---------------- Tabel armada ---------------- */
  U.$('#fleet-table').innerHTML = fleet.map(function (f) {
    var u = f.usage7;
    return '<tr>' +
      '<td class="mono t-xs semi">' + U.esc(f.dev.serial) + '</td>' +
      '<td class="t-xs">' + U.esc(f.patient ? f.patient.name : '-') + '</td>' +
      '<td class="t-xs">' + U.esc(f.dev.firmware) +
      (f.dev.firmware !== '2.4.1' ? ' <span class="badge badge-warning">lama</span>' : '') + '</td>' +
      '<td>' + u.wearAvg + 'j</td>' +
      '<td><span class="badge badge-' + (u.emgQuality >= 80 ? 'success'
        : u.emgQuality >= 65 ? 'warning' : 'danger') + '">' + u.emgQuality + '%</span></td>' +
      '<td>' + u.successRate + '%</td>' +
      '<td class="' + (u.socketTemp >= 36 ? 'c-warning bold' : '') + '">' + u.socketTemp + '°</td>' +
      '<td class="' + (u.socketHumidity >= 62 ? 'c-warning bold' : '') + '">' + u.socketHumidity + '%</td>' +
      '<td>' + u.recalibrations + '</td>' +
      '<td class="t-xs">' + U.nf(f.dev.actuatorCycles) + '</td>' +
      '<td>' + f.dev.batteryHealth + '%</td>' +
      '<td class="t-xs ' + (f.daysToService <= 7 ? 'c-danger bold' : '') + '">' +
      (f.daysToService <= 0 ? 'terlewat' : f.daysToService + ' hari') + '</td>' +
      '<td><span class="risk-flag ' + (f.health === 'kritis' ? 'c-danger'
        : f.health === 'perhatian' ? 'c-warning' : 'c-success') + '">' +
      '<span class="dot ' + (f.health === 'kritis' ? 'dot-danger'
        : f.health === 'perhatian' ? 'dot-warn' : 'dot-live') + '"></span>' +
      U.esc(U.titlecase(f.health)) + '</span></td></tr>';
  }).join('');

  /* ---------------- Grafik EMG ---------------- */
  var COLORS = ['#2b6cde', '#10a5a5', '#7a5af8', '#d98b0b', '#1c9e6b', '#d64545'];

  function drawEmg() {
    var labels = [];
    for (var i = 29; i >= 0; i--) labels.push(U.fmtDate(U.addDays(new Date(), -i), 'short'));
    var series = fleet.slice(0, 6).map(function (f, idx) {
      var map = {};
      Analytics.telemetry(f.dev.patientId, 30).forEach(function (t) { map[t.date] = t.emgQuality; });
      var data = [];
      for (var j = 29; j >= 0; j--) {
        var k = U.dayKey(U.addDays(new Date(), -j));
        data.push(map[k] !== undefined ? map[k] : null);
      }
      return {
        name: f.patient ? f.patient.name : f.dev.serial,
        color: COLORS[idx % COLORS.length], data: data
      };
    });
    Chart.line(U.$('#ch-emg'), {
      labels: labels, height: 250, yMax: 100, ticks: 4, showDots: false,
      series: series, targetLine: 65, targetLabel: 'Batas minimum 65%', targetColor: '#d64545'
    });
    U.$('#emg-legend').innerHTML = series.map(function (s) {
      return '<span><i style="background:' + s.color + '"></i>' +
        U.esc(s.name.split(' ')[0]) + '</span>';
    }).join('');
  }

  function drawEnv() {
    Chart.line(U.$('#ch-env'), {
      labels: fleet.map(function (f) {
        return f.patient ? f.patient.name.split(' ')[0] : f.dev.serial.slice(-4);
      }),
      height: 250, yMax: 100, ticks: 4, yMaxRight: 45,
      series: [
        { name: 'Kelembapan', data: fleet.map(function (f) { return f.usage30.socketHumidity; }),
          color: '#10a5a5', type: 'bar' },
        { name: 'Suhu', data: fleet.map(function (f) { return f.usage30.socketTemp; }),
          color: '#d98b0b', axis: 'right' }
      ]
    });
  }

  drawEmg(); drawEnv();
  Chart.responsive(function () { drawEmg(); drawEnv(); });

  /* ---------------- Jadwal servis ---------------- */
  U.$('#service-list').innerHTML = U.sortBy(fleet, 'daysToService').map(function (f) {
    var overdue = f.daysToService <= 0;
    var soon = f.daysToService <= 14;
    return '<div class="sched-item">' +
      '<span class="sched-time" style="min-width:70px">' +
      '<span class="h" style="font-size:15px">' + (overdue ? '!' : f.daysToService) + '</span>' +
      '<span class="m">' + (overdue ? 'terlewat' : 'hari') + '</span></span>' +
      '<span class="grow" style="min-width:0">' +
      '<span class="t-sm semi mono truncate" style="display:block">' + U.esc(f.dev.serial) + '</span>' +
      '<span class="t-xs muted">' + U.esc(f.patient ? f.patient.name : '-') + ' · ' +
      U.esc(U.fmtDate(f.dev.nextService, 'long')) + '</span>' +
      '<span class="t-xs muted" style="display:block">Servis terakhir ' +
      U.esc(U.fmtDate(f.dev.lastService, 'short')) + ' · ' +
      U.nf(f.dev.actuatorCycles) + ' siklus</span></span>' +
      '<span class="row gap-2 shrink-0">' +
      (overdue ? '<span class="badge badge-danger">Terlewat</span>'
        : soon ? '<span class="badge badge-warning">Segera</span>'
          : '<span class="badge badge-success">Aman</span>') +
      '<button class="btn btn-sm" data-svc="' + U.esc(f.dev.id) + '">' +
      Icon('wrench', 14) + '<span>Catat</span></button>' +
      '</span></div>';
  }).join('');

  U.on(U.$('#service-list'), 'click', '[data-svc]', function (e, btn) {
    openService(btn.dataset.svc);
  });

  function openService(devId) {
    var d = Store.find('devices', devId);
    if (!d) return;
    var p = Store.find('users', d.patientId);

    UI.modal({
      title: 'Catat servis perangkat',
      subtitle: d.serial + ' · ' + (p ? p.name : ''),
      content:
        '<div class="field mb-4"><label class="label" for="sv-note">Tindakan yang dilakukan</label>' +
        '<textarea class="textarea" id="sv-note" maxlength="400" ' +
        'placeholder="Misalnya: bersihkan elektroda, ganti liner, kalibrasi ulang…"></textarea></div>' +
        '<div class="grid g2 gap-3 mb-4">' +
        '<div class="field"><label class="label" for="sv-next">Servis berikutnya (hari)</label>' +
        '<input class="input" type="number" id="sv-next" min="7" max="365" value="90"></div>' +
        '<div class="field"><label class="label" for="sv-status">Status alat</label>' +
        '<select class="select" id="sv-status">' +
        ['baik', 'perhatian', 'perlu-servis'].map(function (s) {
          return '<option value="' + s + '"' + (d.status === s ? ' selected' : '') + '>' +
            U.esc(U.titlecase(s.replace('-', ' '))) + '</option>';
        }).join('') + '</select></div></div>' +
        '<div class="field"><label class="label" for="sv-fw">Firmware</label>' +
        '<input class="input" id="sv-fw" value="' + U.esc(d.firmware) + '" maxlength="12"></div>',
      actions: [
        { label: 'Batal' },
        {
          label: 'Simpan', class: 'btn-primary', icon: 'check',
          onClick: function (m) {
            var note = U.$('#sv-note', m.root).value.trim();
            if (note.length < 5) { UI.toast('Tuliskan tindakan yang dilakukan.', 'warning'); return false; }
            var days = UI.numVal(U.$('#sv-next', m.root), 7, 365, 90);
            Store.update('devices', d.id, {
              lastService: U.today(),
              nextService: U.dayKey(U.addDays(new Date(), days)),
              status: U.$('#sv-status', m.root).value,
              firmware: U.$('#sv-fw', m.root).value.trim() || d.firmware,
              lastServiceNote: note,
              lastServiceBy: user.id
            });
            if (p) {
              Notify.push(p.id, {
                type: 'alat', tone: 'success', icon: 'wrench',
                title: 'Perangkat Anda telah diservis',
                body: note.slice(0, 120),
                link: 'perangkat.html'
              });
            }
            UI.toast('Servis tercatat dan pasien diberi tahu.', 'success');
            setTimeout(function () { location.reload(); }, 900);
          }
        }
      ]
    });
  }

  /* ---------------- Kejadian terkait alat ---------------- */
  var aeDevice = Study.adverseEvents().filter(function (a) {
    return ['alat', 'socket', 'haptik'].indexOf(a.relatedTo) >= 0;
  });
  var aeHost = U.$('#ae-list');
  if (!aeDevice.length) {
    aeHost.innerHTML = UI.empty({ icon: 'checkCircle', title: 'Tidak ada kejadian',
      desc: 'Belum ada laporan masalah teknis dari pasien.' });
  } else {
    aeHost.innerHTML = aeDevice.slice(0, 8).map(function (a) {
      var p = Store.find('users', a.patientId);
      var t = Study.aeType(a.type);
      var sev = Study.AE_SEVERITY[a.severity] || {};
      return '<div class="row-t gap-3">' +
        '<span class="stat-ico ' + (sev.tone === 'success' ? '' : sev.tone) +
        '" style="width:38px;height:38px">' + Icon(t ? t.icon : 'alert', 18) + '</span>' +
        '<span class="grow" style="min-width:0">' +
        '<span class="t-sm semi" style="display:block">' + U.esc(t ? t.label : a.type) + '</span>' +
        '<span class="t-xs muted">' + U.esc(p ? p.name : '-') + ' · ' +
        U.esc(U.fmtDate(a.date, 'short')) + ' · ' + U.esc(a.relatedTo) + '</span>' +
        (a.body ? '<span class="t-xs muted-2" style="display:block;margin-top:3px">"' +
          U.esc(a.body.slice(0, 90)) + '"</span>' : '') +
        '</span>' +
        '<span class="badge badge-' + (a.status === 'selesai' ? 'success' : 'warning') +
        ' shrink-0">' + U.esc(a.status) + '</span></div>';
    }).join('');
  }

  /* ---------------- Ekspor armada ---------------- */
  U.$('#btn-export').addEventListener('click', function () {
    var rows = fleet.map(function (f) {
      var u = f.usage7;
      return [f.dev.serial, f.patient ? f.patient.name : '', f.dev.model, f.dev.firmware,
        u.wearAvg, u.emgQuality, u.successRate, u.socketTemp, u.socketHumidity,
        u.recalibrations, f.dev.actuatorCycles, f.dev.batteryHealth,
        f.dev.lastService, f.dev.nextService, f.daysToService, f.health,
        f.alerts.map(function (a) { return a.text; }).join(' | ')];
    });
    var headers = ['serial', 'pasien', 'model', 'firmware', 'jam_pakai_rata2', 'mutu_emg',
      'grip_sukses_pct', 'suhu_socket', 'kelembapan_socket', 'rekalibrasi_7hari',
      'siklus_aktuator', 'kesehatan_baterai', 'servis_terakhir', 'servis_berikut',
      'hari_ke_servis', 'kondisi', 'peringatan'];
    U.downloadText('asta_armada_' + U.today() + '.csv',
      U.toCSV(rows, headers), 'text/csv;charset=utf-8');
    UI.toast('Data armada diunduh.', 'success');
  });
})();
