/* ============================================================
   ASTA — Jadwal & Pengingat
   Kalender status latihan, jadwal berulang, pengingat
   berjenjang, dan telekonsultasi.
   ============================================================ */
(function () {
  'use strict';

  Seed.run();
  var user = Auth.guard(['pasien', 'terapis', 'prostetis', 'admin']);
  if (!user) return;

  var isPatient = user.role === 'pasien';
  var patient = isPatient ? user : Auth.activePatient();
  var shell = Shell.mount({
    title: isPatient ? 'Jadwal & Pengingat' : 'Jadwal & Konsultasi',
    desc: isPatient ? 'Atur rutinitas terapi dan pengingat Anda'
      : 'Agenda konsultasi dan kunjungan',
    actions: isPatient
      ? '<button class="btn btn-primary" id="btn-add">' + Icon('plus', 18) + '<span>Tambah Jadwal</span></button>'
      : ''
  });
  if (!shell) return;
  var c = shell.content;

  var viewMonth = new Date();
  viewMonth.setDate(1);

  render();

  function render() {
    var perm = Notify.permission();

    c.innerHTML =
      (isPatient && perm !== 'granted'
        ? '<div class="alert ' + (perm === 'denied' ? 'warning' : 'info') + '" id="perm-box">' +
          '<span class="a-ico">' + Icon('bell', 18) + '</span>' +
          '<span class="grow t-sm">' +
          (perm === 'denied'
            ? 'Notifikasi peramban diblokir. Pengingat tetap muncul di dalam aplikasi, namun tidak saat aplikasi ditutup. Anda dapat mengubahnya di pengaturan situs pada peramban.'
            : perm === 'unsupported'
              ? 'Peramban ini tidak mendukung notifikasi sistem. Pengingat akan tampil di dalam aplikasi.'
              : 'Izinkan notifikasi agar pengingat tetap sampai walaupun aplikasi ditutup.') +
          '</span>' +
          (perm === 'default'
            ? '<button class="btn btn-sm btn-primary shrink-0" id="btn-perm">Izinkan</button>' : '') +
          '</div>'
        : '') +

      '<section class="grid g-2-1">' +
      /* ===== Kalender ===== */
      '<div class="card">' +
      '<div class="card-head">' +
      '<div><div class="card-title" id="cal-title"></div>' +
      '<div class="card-sub">Warna titik menunjukkan aktivitas tiap hari</div></div>' +
      '<div class="row gap-2">' +
      '<button class="btn btn-icon btn-sm" id="cal-prev" aria-label="Bulan sebelumnya">' +
      Icon('chevronLeft', 17) + '</button>' +
      '<button class="btn btn-sm" id="cal-today">Hari ini</button>' +
      '<button class="btn btn-icon btn-sm" id="cal-next" aria-label="Bulan berikutnya">' +
      Icon('chevronRight', 17) + '</button>' +
      '</div></div>' +
      '<div class="cal mb-2">' +
      U.DOW_S.map(function (d) { return '<div class="cal-dow">' + d + '</div>'; }).join('') +
      '</div>' +
      '<div class="cal" id="cal-grid"></div>' +
      '<div class="legend-pain mt-4">' +
      '<span><i style="background:var(--success)"></i>Latihan selesai</span>' +
      '<span><i style="background:var(--violet)"></i>Nyeri dicatat</span>' +
      '<span><i style="background:var(--primary-300)"></i>Terjadwal</span>' +
      '<span><i style="background:var(--danger)"></i>Terlewat</span>' +
      '</div></div>' +

      /* ===== Hari ini ===== */
      '<div class="col gap-4">' +
      '<div class="card">' +
      '<div class="card-head"><div><div class="card-title">Hari ini</div>' +
      '<div class="card-sub">' + U.esc(U.fmtDate(new Date(), 'dow')) + '</div></div></div>' +
      '<div class="col gap-3" id="today-list"></div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-head"><div class="card-title">Telekonsultasi</div></div>' +
      '<div class="col gap-3" id="appt-list"></div>' +
      '</div>' +
      '</div></section>' +

      (isPatient
        ? '<section class="grid g-2-1">' +
          '<div class="card">' +
          '<div class="card-head"><div><div class="card-title">Jadwal berulang</div>' +
          '<div class="card-sub">Rutinitas mingguan Anda</div></div></div>' +
          '<div class="col gap-3" id="sched-list"></div>' +
          '</div>' +

          '<div class="card">' +
          '<div class="card-head"><div><div class="card-title">Pengaturan pengingat</div>' +
          '<div class="card-sub">Eskalasi berjenjang bila latihan terlewat</div></div></div>' +
          '<div id="reminder-cfg"></div>' +
          '</div></section>'
        : '') +

      /* ===== Peta panas kepatuhan ===== */
      '<section class="card">' +
      '<div class="card-head"><div><div class="card-title">Peta aktivitas 12 minggu</div>' +
      '<div class="card-sub">Kotak lebih gelap berarti sesi lebih lama pada hari itu</div></div></div>' +
      '<div style="overflow-x:auto"><div class="heat" id="heat"></div></div>' +
      '<div class="row between mt-3 t-xs muted">' +
      '<span id="heat-from"></span>' +
      '<span class="row gap-2">Sedikit ' +
      [0, 1, 2, 3, 4].map(function (l) {
        return '<span class="heat-cell" data-lvl="' + l + '" style="width:12px;height:12px"></span>';
      }).join('') + ' Banyak</span>' +
      '<span>Hari ini</span></div>' +
      '</section>';

    var pb = U.$('#btn-perm');
    if (pb) {
      pb.addEventListener('click', function () {
        Notify.requestPermission().then(function (res) {
          if (res === 'granted') {
            UI.toast('Notifikasi diizinkan. Pengingat akan dikirim tepat waktu.', 'success');
            Notify.system('Notifikasi aktif', 'ASTA akan mengingatkan jadwal terapi Anda.');
          } else {
            UI.toast('Izin tidak diberikan. Pengingat tetap tampil di dalam aplikasi.', 'info');
          }
          render();
        });
      });
    }

    U.$('#cal-prev').addEventListener('click', function () {
      viewMonth.setMonth(viewMonth.getMonth() - 1); renderCal();
    });
    U.$('#cal-next').addEventListener('click', function () {
      viewMonth.setMonth(viewMonth.getMonth() + 1); renderCal();
    });
    U.$('#cal-today').addEventListener('click', function () {
      viewMonth = new Date(); viewMonth.setDate(1); renderCal();
    });

    renderCal();
    renderToday();
    renderAppointments();
    if (isPatient) { renderSchedules(); renderReminderCfg(); }
    renderHeat();

    var add = U.$('#btn-add');
    if (add) add.addEventListener('click', function () { openSchedForm(null); });
  }

  /* ============================================================
     Kalender
     ============================================================ */
  function renderCal() {
    if (!patient) return;
    U.$('#cal-title').textContent = U.MON[viewMonth.getMonth()] + ' ' + viewMonth.getFullYear();

    var first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    var startPad = first.getDay();
    var daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    var todayKey = U.today();

    // Indeks aktivitas
    var sesByDay = U.groupBy(Store.list('sessions').filter(function (s) {
      return s.patientId === patient.id;
    }), 'date');
    var painByDay = {};
    Store.list('painLogs').forEach(function (p) {
      if (p.patientId === patient.id) painByDay[p.date] = p;
    });
    var scheds = Analytics.schedules(patient.id);

    var cells = [];
    // Padding awal
    for (var i = 0; i < startPad; i++) {
      var pd = U.addDays(first, -(startPad - i));
      cells.push(cell(pd, true));
    }
    for (var d = 1; d <= daysInMonth; d++) {
      cells.push(cell(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d), false));
    }
    // Padding akhir agar genap 7
    while (cells.length % 7 !== 0) {
      cells.push(cell(U.addDays(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), daysInMonth),
        cells.length % 7), true));
    }

    U.$('#cal-grid').innerHTML = cells.join('');
    U.on(U.$('#cal-grid'), 'click', '[data-day]', function (e, btn) {
      showDay(btn.dataset.day);
    });

    function cell(date, other) {
      var key = U.dayKey(date);
      var isToday = key === todayKey;
      var dots = [];
      var ses = sesByDay[key] || [];
      if (ses.length) dots.push('done');
      if (painByDay[key]) dots.push('pain');

      var dow = date.getDay();
      var planned = scheds.filter(function (s) { return (s.days || []).indexOf(dow) >= 0; });
      if (planned.length && key >= todayKey) dots.push('plan');
      // Terlewat: ada jadwal latihan, sudah lewat, tapi tidak ada sesi
      if (planned.some(function (s) { return s.type === 'latihan'; }) && key < todayKey && !ses.length) {
        dots.push('miss');
      }

      return '<button class="cal-cell' + (other ? ' other' : '') + (isToday ? ' today' : '') + '" ' +
        'data-day="' + key + '" aria-label="' + U.esc(U.fmtDate(date, 'long')) + '">' +
        '<span class="cd">' + date.getDate() + '</span>' +
        '<span class="cdots">' + dots.map(function (t) {
          return '<span class="cdot ' + t + '"></span>';
        }).join('') + '</span></button>';
    }
  }

  function showDay(key) {
    var ses = Store.list('sessions').filter(function (s) {
      return s.patientId === patient.id && s.date === key;
    });
    var pain = Store.list('painLogs').find(function (p) {
      return p.patientId === patient.id && p.date === key;
    });
    var phase = Study.phaseOn(patient.id, key);
    var tel = Store.list('telemetry').find(function (t) {
      return t.patientId === patient.id && t.date === key;
    });

    UI.modal({
      title: U.fmtDate(key, 'dow'),
      subtitle: phase ? 'Fase ' + Study.phaseDef(phase.phase).label : '',
      content:
        '<div class="grid g3 gap-3 mb-4">' +
        '<div class="mini-stat"><span class="ms-v">' + ses.length + '</span>' +
        '<span class="ms-l">Sesi latihan</span></div>' +
        '<div class="mini-stat"><span class="ms-v">' + (pain ? pain.level + '/10' : '–') + '</span>' +
        '<span class="ms-l">Nyeri</span></div>' +
        '<div class="mini-stat"><span class="ms-v">' + (tel ? tel.wearHours + 'j' : '–') + '</span>' +
        '<span class="ms-l">Pakai alat</span></div>' +
        '</div>' +
        (ses.length
          ? '<div class="div-label">Latihan</div>' +
            ses.map(function (s) {
              return '<div class="mb-3"><div class="row between mb-2">' +
                '<span class="t-sm semi">' + U.esc(U.fmtTime(s.startedAt)) + ' · ' +
                U.esc(U.dur(s.durationMin)) + '</span>' +
                '<span class="badge badge-' + (s.status === 'selesai' ? 'success' : 'warning') + '">' +
                U.esc(s.status) + '</span></div>' +
                (s.exercises || []).map(function (e) {
                  var ex = Seed.exercise(e.exId);
                  return '<div class="row between t-xs muted"><span>' +
                    U.esc(ex ? ex.name : e.exId) + '</span><span>' + e.done + '/' + e.target +
                    ' ' + U.esc(e.unit) + '</span></div>';
                }).join('') +
                (s.note ? '<div class="t-xs c-primary mt-1">' + Icon('message', 11) + ' ' +
                  U.esc(s.note) + '</div>' : '') +
                '</div>';
            }).join('')
          : '<p class="t-sm muted">Tidak ada sesi latihan pada hari ini.</p>') +
        (pain
          ? '<div class="div-label">Catatan nyeri</div>' +
            '<div class="t-sm"><strong>' + pain.level + '/10</strong> — ' +
            U.esc(U.painLabel(pain.level)) + '<br>' +
            '<span class="muted t-xs">Pemicu: ' + U.esc(pain.trigger || '-') +
            ' · Durasi: ' + U.esc(U.dur(pain.durationMin || 0)) +
            (pain.sleepDisturbed ? ' · tidur terganggu' : '') + '</span>' +
            (pain.note ? '<br><span class="t-xs c-violet">' + U.esc(pain.note) + '</span>' : '') +
            '</div>'
          : ''),
      actions: [{ label: 'Tutup', class: 'btn-primary' }]
    });
  }

  /* ============================================================
     Hari ini
     ============================================================ */
  function renderToday() {
    var host = U.$('#today-list');
    if (!patient) { host.innerHTML = ''; return; }
    var list = Analytics.todaySchedule(patient.id);
    if (!list.length) {
      host.innerHTML = UI.empty({ icon: 'calendar', title: 'Tidak ada jadwal',
        desc: 'Hari ini kosong. Anda tetap boleh berlatih bila ingin.' });
      return;
    }
    host.innerHTML = list.map(function (s) {
      var link = s.type === 'nyeri' ? 'catatan-nyeri.html'
        : s.type === 'phantom' ? 'terapi-phantom.html' : 'sesi-latihan.html';
      var ico = s.type === 'nyeri' ? 'brain' : s.type === 'phantom' ? 'mirror' : 'activity';
      return '<a class="sched-item card-link" href="' + link + '">' +
        '<span class="sched-time"><span class="h">' + U.esc(s.time.split(':')[0]) + '</span>' +
        '<span class="m">' + U.esc(s.time.split(':')[1]) + '</span></span>' +
        '<span class="stat-ico ' + (s.type === 'nyeri' ? 'violet' : s.type === 'phantom' ? 'teal' : '') +
        '" style="width:38px;height:38px">' + Icon(ico, 18) + '</span>' +
        '<span class="grow" style="min-width:0">' +
        '<span class="t-sm semi truncate" style="display:block">' + U.esc(s.title) + '</span>' +
        '<span class="t-xs muted">' + s.durationMin + ' menit</span></span>' +
        (s.done ? '<span class="badge badge-success">' + Icon('check', 12) + '</span>'
          : s.overdue ? '<span class="badge badge-warning">Terlewat</span>' : '') +
        '</a>';
    }).join('');
  }

  /* ============================================================
     Telekonsultasi
     ============================================================ */
  function renderAppointments() {
    var host = U.$('#appt-list');
    var list = Analytics.upcomingAppointments(isPatient ? user.id : user.id, 6);
    if (!list.length) {
      host.innerHTML = UI.empty({ icon: 'video', title: 'Tidak ada jadwal konsultasi' });
      return;
    }
    host.innerHTML = list.map(function (a) {
      var other = Store.find('users', a.patientId === user.id ? a.withId : a.patientId);
      var dt = new Date(a.at);
      var mins = Math.round((dt - Date.now()) / 60000);
      var soon = mins > 0 && mins <= 30;
      return '<div class="sched-item">' +
        '<span class="sched-time"><span class="h">' + U.esc(U.fmtTime(dt).split(':')[0]) + '</span>' +
        '<span class="m">' + U.esc(U.fmtTime(dt).split(':')[1]) + '</span></span>' +
        '<span class="grow" style="min-width:0">' +
        '<span class="t-sm semi truncate" style="display:block">' + U.esc(a.title) + '</span>' +
        '<span class="t-xs muted">' + U.esc(other ? other.name : '-') + ' · ' +
        U.esc(U.fmtDate(dt, 'short')) + ' · ' + a.durationMin + ' menit</span>' +
        (a.note ? '<span class="t-xs c-primary" style="display:block;margin-top:3px">' +
          U.esc(a.note) + '</span>' : '') +
        '</span>' +
        (soon
          ? '<button class="btn btn-sm btn-primary shrink-0" data-join="' + U.esc(a.id) + '">' +
            Icon('video', 15) + '<span>Masuk</span></button>'
          : '<span class="badge shrink-0">' + U.esc(U.fmtDate(dt, 'short')) + '</span>') +
        '</div>';
    }).join('');

    U.on(host, 'click', '[data-join]', function () {
      UI.modal({
        title: 'Ruang telekonsultasi',
        size: 'sm',
        content: '<div class="alert info"><span class="a-ico">' + Icon('info', 18) + '</span>' +
          '<span class="t-sm">Panggilan video belum diaktifkan pada prototipe ini. ' +
          'Pada versi produksi, ruang konsultasi memakai WebRTC terenkripsi dengan panel ' +
          'telemetri lengan di samping video.</span></div>',
        actions: [{ label: 'Mengerti', class: 'btn-primary' }]
      });
    });
  }

  /* ============================================================
     Jadwal berulang
     ============================================================ */
  function renderSchedules() {
    var host = U.$('#sched-list');
    var list = Store.list('schedules').filter(function (s) { return s.patientId === user.id; });
    if (!list.length) {
      host.innerHTML = UI.empty({ icon: 'calendar', title: 'Belum ada jadwal berulang',
        desc: 'Tambahkan jadwal agar pengingat dikirim otomatis.' });
      return;
    }
    host.innerHTML = list.map(function (s) {
      var ico = s.type === 'nyeri' ? 'brain' : s.type === 'phantom' ? 'mirror' : 'activity';
      return '<div class="sched-item">' +
        '<span class="sched-time"><span class="h">' + U.esc(s.time.split(':')[0]) + '</span>' +
        '<span class="m">' + U.esc(s.time.split(':')[1]) + '</span></span>' +
        '<span class="stat-ico ' + (s.type === 'nyeri' ? 'violet' : s.type === 'phantom' ? 'teal' : '') +
        '" style="width:38px;height:38px">' + Icon(ico, 18) + '</span>' +
        '<span class="grow" style="min-width:0">' +
        '<span class="t-sm semi truncate" style="display:block">' + U.esc(s.title) + '</span>' +
        '<span class="t-xs muted">' + U.esc(dayLabel(s.days)) + ' · ' + s.durationMin + ' menit' +
        (s.reminder ? ' · ingatkan ' + s.reminderBefore + ' menit sebelumnya' : ' · tanpa pengingat') +
        '</span></span>' +
        '<span class="row gap-1 shrink-0">' +
        '<label class="switch" data-tip="Aktif/nonaktif">' +
        '<input type="checkbox" data-toggle="' + U.esc(s.id) + '"' +
        (s.active !== false ? ' checked' : '') + '>' +
        '<span class="track" aria-hidden="true"></span></label>' +
        '<button class="btn btn-ghost btn-icon btn-sm" data-edit="' + U.esc(s.id) +
        '" aria-label="Ubah jadwal">' + Icon('edit', 16) + '</button>' +
        '<button class="btn btn-ghost btn-icon btn-sm" data-del="' + U.esc(s.id) +
        '" aria-label="Hapus jadwal">' + Icon('trash', 16) + '</button>' +
        '</span></div>';
    }).join('');

    U.on(host, 'change', '[data-toggle]', function (e, el) {
      Store.update('schedules', el.dataset.toggle, { active: el.checked });
      UI.toast(el.checked ? 'Jadwal diaktifkan.' : 'Jadwal dinonaktifkan.', 'info', { duration: 1800 });
      renderCal(); renderToday();
    });
    U.on(host, 'click', '[data-edit]', function (e, el) {
      openSchedForm(Store.find('schedules', el.dataset.edit));
    });
    U.on(host, 'click', '[data-del]', function (e, el) {
      var s = Store.find('schedules', el.dataset.del);
      UI.confirm({
        title: 'Hapus jadwal?',
        message: '"' + (s ? s.title : '') + '" akan dihapus beserta pengingatnya.',
        okLabel: 'Hapus', danger: true
      }).then(function (ok) {
        if (!ok) return;
        Store.delete('schedules', el.dataset.del);
        UI.toast('Jadwal dihapus.', 'info');
        renderSchedules(); renderCal(); renderToday();
      });
    });
  }

  function dayLabel(days) {
    if (!days || !days.length) return 'Tidak ada hari';
    if (days.length === 7) return 'Setiap hari';
    var wd = [1, 2, 3, 4, 5];
    if (days.length === 5 && wd.every(function (d) { return days.indexOf(d) >= 0; })) return 'Senin–Jumat';
    return days.slice().sort().map(function (d) { return U.DOW_S[d]; }).join(', ');
  }

  function openSchedForm(existing) {
    var st = {
      type: existing ? existing.type : 'latihan',
      days: existing ? (existing.days || []).slice() : [1, 2, 3, 4, 5]
    };

    UI.modal({
      title: existing ? 'Ubah jadwal' : 'Tambah jadwal',
      content:
        '<div class="field mb-4"><label class="label" for="s-title">Nama jadwal</label>' +
        '<input class="input" id="s-title" maxlength="60" value="' +
        U.esc(existing ? existing.title : '') + '" placeholder="Misalnya: Latihan Pagi"></div>' +

        '<div class="field mb-4"><span class="label">Jenis</span>' +
        '<div class="row gap-2 wrap" id="s-type">' +
        [['latihan', 'Latihan motorik', 'activity'], ['phantom', 'Terapi phantom', 'mirror'],
        ['nyeri', 'Catat nyeri', 'brain']].map(function (t) {
          return '<button type="button" class="chip" data-t="' + t[0] + '" aria-pressed="' +
            (st.type === t[0]) + '">' + Icon(t[2], 15) + '<span>' + t[1] + '</span></button>';
        }).join('') + '</div></div>' +

        '<div class="grid g2 gap-4 mb-4">' +
        '<div class="field"><label class="label" for="s-time">Waktu</label>' +
        '<input class="input" type="time" id="s-time" value="' +
        U.esc(existing ? existing.time : '08:00') + '"></div>' +
        '<div class="field"><label class="label" for="s-dur">Durasi (menit)</label>' +
        '<input class="input" type="number" id="s-dur" min="3" max="120" value="' +
        (existing ? existing.durationMin : 25) + '"></div></div>' +

        '<div class="field mb-4"><span class="label">Hari</span>' +
        '<div class="row gap-2 wrap" id="s-days">' +
        U.DOW_S.map(function (d, i) {
          return '<button type="button" class="chip" data-d="' + i + '" aria-pressed="' +
            (st.days.indexOf(i) >= 0) + '" style="min-width:56px;justify-content:center">' +
            d + '</button>';
        }).join('') + '</div></div>' +

        '<label class="check mb-3"><input type="checkbox" id="s-rem"' +
        (!existing || existing.reminder ? ' checked' : '') + '>' +
        '<span class="box" aria-hidden="true"></span>' +
        '<span class="t-sm">Kirim pengingat</span></label>' +
        '<div class="field"><label class="label" for="s-before">Ingatkan berapa menit sebelumnya</label>' +
        '<input class="input" type="number" id="s-before" min="0" max="120" value="' +
        (existing ? existing.reminderBefore : 15) + '"></div>',

      actions: [
        { label: 'Batal' },
        {
          label: existing ? 'Simpan' : 'Tambah', class: 'btn-primary', icon: 'check',
          onClick: function (m) {
            var title = U.$('#s-title', m.root).value.trim();
            if (!title) { UI.toast('Nama jadwal wajib diisi.', 'warning'); return false; }
            if (!st.days.length) { UI.toast('Pilih minimal satu hari.', 'warning'); return false; }

            var payload = {
              patientId: user.id, type: st.type, title: title,
              time: U.$('#s-time', m.root).value || '08:00',
              days: st.days.slice().sort(),
              durationMin: UI.numVal(U.$('#s-dur', m.root), 3, 120, 25),
              reminder: U.$('#s-rem', m.root).checked,
              reminderBefore: UI.numVal(U.$('#s-before', m.root), 0, 120, 15),
              active: true
            };
            if (existing) {
              Store.update('schedules', existing.id, payload);
              UI.toast('Jadwal diperbarui.', 'success');
            } else {
              Store.insert('schedules', payload);
              UI.toast('Jadwal ditambahkan. Pengingat akan dikirim otomatis.', 'success');
            }
            renderSchedules(); renderCal(); renderToday();
          }
        }
      ],
      onOpen: function (m) {
        U.on(m.root, 'click', '[data-t]', function (e, b) {
          st.type = b.dataset.t;
          U.$$('[data-t]', m.root).forEach(function (x) {
            x.setAttribute('aria-pressed', String(x.dataset.t === st.type));
          });
        });
        U.on(m.root, 'click', '[data-d]', function (e, b) {
          var d = Number(b.dataset.d);
          var i = st.days.indexOf(d);
          if (i >= 0) st.days.splice(i, 1); else st.days.push(d);
          b.setAttribute('aria-pressed', String(st.days.indexOf(d) >= 0));
        });
      }
    });
  }

  /* ============================================================
     Konfigurasi pengingat berjenjang
     ============================================================ */
  function renderReminderCfg() {
    var st = Store.get('settings', {});
    U.$('#reminder-cfg').innerHTML =
      '<div class="timeline mb-4">' +
      '<div class="tl-item"><div class="t-sm semi">Tepat waktu</div>' +
      '<div class="t-xs muted">Pengingat dikirim ke Anda sesuai jadwal</div></div>' +
      '<div class="tl-item warn"><div class="t-sm semi">Setelah 90 menit</div>' +
      '<div class="t-xs muted">Pengingat kedua bila jadwal belum dikerjakan</div></div>' +
      '<div class="tl-item warn"><div class="t-sm semi">Setelah 3 hari kosong</div>' +
      '<div class="t-xs muted">Anda diberi tahu bahwa terapis akan dikabari</div></div>' +
      '<div class="tl-item bad"><div class="t-sm semi">Setelah ' +
      ((st.escalateAfterDays || 3) + 4) + ' hari kosong</div>' +
      '<div class="t-xs muted">Terapis menerima peringatan risiko putus terapi</div></div>' +
      '</div>' +

      '<div class="field mb-4">' +
      '<div class="row between"><label class="label" for="r-lead">Pengingat bawaan</label>' +
      '<span class="t-sm bold" id="r-lead-v">' + (st.reminderLead || 15) + ' menit</span></div>' +
      '<input class="range" type="range" id="r-lead" min="0" max="60" step="5" value="' +
      (st.reminderLead || 15) + '"></div>' +

      '<div class="field mb-4">' +
      '<div class="row between"><label class="label" for="r-esc">Eskalasi ke terapis setelah</label>' +
      '<span class="t-sm bold" id="r-esc-v">' + ((st.escalateAfterDays || 3) + 4) + ' hari</span></div>' +
      '<input class="range" type="range" id="r-esc" min="1" max="10" value="' +
      (st.escalateAfterDays || 3) + '"></div>' +

      '<label class="switch mb-3"><input type="checkbox" id="r-sound"' +
      (st.notifSound ? ' checked' : '') + '>' +
      '<span class="track" aria-hidden="true"></span>' +
      '<span class="t-sm semi">Suara notifikasi</span></label>' +
      '<label class="switch"><input type="checkbox" id="r-push"' +
      (st.notifPush ? ' checked' : '') + '>' +
      '<span class="track" aria-hidden="true"></span>' +
      '<span class="t-sm semi">Notifikasi sistem</span></label>' +
      '<button class="btn btn-block mt-4" id="r-test">' + Icon('bell', 17) +
      '<span>Uji notifikasi</span></button>';

    var lead = U.$('#r-lead');
    lead.addEventListener('input', function () {
      U.$('#r-lead-v').textContent = this.value + ' menit';
    });
    lead.addEventListener('change', function () {
      saveSetting({ reminderLead: Number(this.value) });
    });

    var esc = U.$('#r-esc');
    esc.addEventListener('input', function () {
      U.$('#r-esc-v').textContent = (Number(this.value) + 4) + ' hari';
    });
    esc.addEventListener('change', function () {
      saveSetting({ escalateAfterDays: Number(this.value) });
      renderReminderCfg();
    });

    U.$('#r-sound').addEventListener('change', function () {
      saveSetting({ notifSound: this.checked });
    });
    U.$('#r-push').addEventListener('change', function () {
      saveSetting({ notifPush: this.checked });
      if (this.checked && Notify.permission() === 'default') {
        Notify.requestPermission();
      }
    });

    U.$('#r-test').addEventListener('click', function () {
      Notify.push(user.id, {
        type: 'reminder', tone: 'primary', icon: 'bell',
        title: 'Uji pengingat ASTA',
        body: 'Beginilah tampilan pengingat jadwal terapi Anda.',
        link: 'jadwal.html'
      });
    });
  }

  function saveSetting(patch) {
    Store.set('settings', Object.assign(Store.get('settings', {}), patch));
    UI.toast('Pengaturan disimpan.', 'success', { duration: 1600 });
  }

  /* ============================================================
     Peta panas aktivitas
     ============================================================ */
  function renderHeat() {
    if (!patient) return;
    var host = U.$('#heat');
    var days = 84;
    var byDay = {};
    Store.list('sessions').forEach(function (s) {
      if (s.patientId !== patient.id) return;
      byDay[s.date] = (byDay[s.date] || 0) + (s.durationMin || 0);
    });

    // Mulai dari hari Minggu agar kolom rapi
    var start = U.addDays(new Date(), -(days - 1));
    start = U.addDays(start, -start.getDay());

    var cells = [];
    var cursor = U.d(start);
    var todayKey = U.today();
    while (U.dayKey(cursor) <= todayKey) {
      var key = U.dayKey(cursor);
      var mins = byDay[key] || 0;
      var lvl = mins === 0 ? 0 : mins < 15 ? 1 : mins < 30 ? 2 : mins < 50 ? 3 : 4;
      cells.push('<span class="heat-cell" data-lvl="' + lvl + '" ' +
        'data-tip="' + U.esc(U.fmtDate(cursor, 'short') + ': ' + (mins ? U.dur(mins) : 'tidak latihan')) +
        '"></span>');
      cursor = U.addDays(cursor, 1);
    }
    host.innerHTML = cells.join('');
    U.$('#heat-from').textContent = U.fmtDate(start, 'short');
  }
})();
