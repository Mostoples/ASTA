/* ============================================================
   ASTA — Halaman placeholder terkelola
   Dipakai oleh rute yang sudah ada di navigasi namun modulnya
   belum diimplementasikan. Tujuannya supaya navigasi utuh
   (tidak ada 404) dan lingkup fitur tetap terdokumentasi.
   ============================================================ */
(function () {
  'use strict';

  Seed.run();

  var meta = document.body.dataset;
  var allowed = meta.roles ? meta.roles.split(',') : null;

  var user = Auth.guard(allowed);
  if (!user) return;

  var shell = Shell.mount({
    title: meta.pageTitle || 'Modul',
    desc: meta.pageDesc || ''
  });
  if (!shell) return;

  var planned = (meta.planned || '').split('|').filter(Boolean);
  var homeHref = Auth.role(shell.session.role).home;

  shell.content.innerHTML =
    '<section class="card pad-lg">' +
    '<div class="row-t gap-4 mb-5">' +
    '<span class="stat-ico" style="width:56px;height:56px">' + Icon(meta.icon || 'clipboard', 26) + '</span>' +
    '<div class="grow">' +
    '<h2>' + U.esc(meta.pageTitle || 'Modul') + '</h2>' +
    '<p class="muted t-sm mt-2 mb-0" style="max-width:64ch">' + U.esc(meta.pageDesc || '') + '</p>' +
    '</div>' +
    '<span class="badge badge-warning shrink-0">Dalam pengembangan</span>' +
    '</div>' +

    '<div class="alert info">' +
    '<span class="a-ico">' + Icon('info', 18) + '</span>' +
    '<span class="t-sm">Modul ini sudah masuk lingkup ASTA dan terhubung di navigasi, ' +
    'tetapi antarmukanya belum diimplementasikan. Fondasi datanya sudah tersedia ' +
    '(sesi latihan, catatan nyeri, telemetri alat, jadwal), sehingga halaman ini bisa diisi ' +
    'tanpa mengubah struktur aplikasi.</span>' +
    '</div>' +

    (planned.length
      ? '<div class="div-label">Rencana isi halaman</div>' +
        '<div class="grid g2">' + planned.map(function (p) {
          return '<div class="row-t gap-3">' +
            '<span class="stat-ico" style="width:34px;height:34px">' + Icon('check', 15) + '</span>' +
            '<span class="t-sm semi" style="padding-top:6px">' + U.esc(p) + '</span></div>';
        }).join('') + '</div>'
      : '') +

    '<div class="row gap-2 mt-6 wrap">' +
    '<a class="btn btn-primary" href="' + U.esc(homeHref) + '">' + Icon('home', 18) + '<span>Kembali ke dasbor</span></a>' +
    '</div>' +
    '</section>';
})();
