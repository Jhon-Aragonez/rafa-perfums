/* Rafa Perfum's - lógica de la tienda (JavaScript simple, sin librerías) */
(function () {
  "use strict";

  var body = document.body;
  var STATIC = body.dataset.static || "/static/";
  var WA = body.dataset.wa;
  var NEGOCIO = body.dataset.negocio || "Rafa Perfum's";
  var PRODUCTS = JSON.parse(document.getElementById("products-data").textContent);
  var BY_ID = {};
  PRODUCTS.forEach(function (p, i) { p._i = i; BY_ID[p.id] = p; });

  var CATS = [
    ["todos", "Todos"], ["mujer", "Mujer"], ["hombre", "Hombre"], ["unisex", "Unisex"],
    ["ninos", "Niños"], ["sets", "Sets"], ["nicho", "Nicho"]
  ];
  var CAT_LABEL = { mujer: "Mujer", hombre: "Hombre", unisex: "Unisex", ninos: "Niños y niñas", sets: "Set de regalo", nicho: "Nicho" };
  var PAGE = 24;

  var state = { cat: "todos", q: "", sort: "destacados", shown: PAGE };
  var cart = [];

  /* ---------- utilidades ---------- */
  function $(id) { return document.getElementById(id); }
  function money(n) { return "$" + Math.round(n).toLocaleString("es-CO"); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function norm(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function img(p) { return STATIC + p.imagen; }
  function availableOpts(p) { return p.opciones.filter(function (o) { return o.disponible; }); }
  function isOut(p) { return availableOpts(p).length === 0; }
  function minPrice(p) {
    var list = availableOpts(p);
    if (!list.length) list = p.opciones;
    return Math.min.apply(null, list.map(function (o) { return o.price; }));
  }
  function haystack(p) {
    return norm([p.nombre, p.marca, p.familia, p.descripcion, p.para, p.categoria,
      p.notas.salida.join(" "), p.notas.corazon.join(" "), p.notas.fondo.join(" ")].join(" "));
  }
  PRODUCTS.forEach(function (p) { p._h = haystack(p); });

  /* ---------- filtros y grilla ---------- */
  function filtered() {
    var q = norm(state.q).trim();
    var list = PRODUCTS.filter(function (p) {
      if (state.cat !== "todos" && p.categoria !== state.cat) return false;
      if (q && p._h.indexOf(q) === -1) return false;
      return true;
    });
    list.sort(function (a, b) {
      if (state.sort === "menor") return minPrice(a) - minPrice(b);
      if (state.sort === "mayor") return minPrice(b) - minPrice(a);
      if (state.sort === "az") return a.nombre.localeCompare(b.nombre, "es");
      var oa = isOut(a) ? 1 : 0, ob = isOut(b) ? 1 : 0;
      return oa - ob || a._i - b._i;
    });
    return list;
  }

  function cardHTML(p) {
    var out = isOut(p);
    var badge = out ? '<span class="badge">Agotado</span>' :
      (p.solo_decants ? '<span class="badge soft">Solo decants</span>' : "");
    var meta = [p.para, p.solo_decants ? "Decants 9 ml y 5 ml" : p.contenido].filter(Boolean).join(" · ");
    return '<button type="button" class="card' + (out ? " is-out" : "") + '" data-id="' + esc(p.id) + '" aria-label="Ver ' + esc(p.nombre) + '">' +
      '<span class="card-img">' + badge +
      '<img src="' + img(p) + '" alt="' + esc(p.nombre) + '" loading="lazy" width="200" height="210"></span>' +
      '<span class="card-body">' +
      '<span class="card-brand">' + esc(p.marca) + '</span>' +
      '<span class="card-name">' + esc(p.nombre) + '</span>' +
      '<span class="card-meta">' + esc(meta) + '</span>' +
      '<span class="card-price"><small>' + (out ? "Antes" : "Desde") + '</small>' + money(minPrice(p)) + '</span>' +
      '</span></button>';
  }

  function renderChips() {
    var counts = { todos: PRODUCTS.length };
    PRODUCTS.forEach(function (p) { counts[p.categoria] = (counts[p.categoria] || 0) + 1; });
    $("chips").innerHTML = CATS.map(function (c) {
      return '<button type="button" class="chip" role="tab" data-cat="' + c[0] + '" aria-selected="' + (state.cat === c[0]) + '">' +
        c[1] + '<small>' + (counts[c[0]] || 0) + '</small></button>';
    }).join("");
  }

  function renderGrid() {
    var list = filtered();
    var slice = list.slice(0, state.shown);
    $("grid").innerHTML = slice.map(cardHTML).join("");
    $("empty").hidden = list.length > 0;
    $("more").hidden = list.length <= state.shown;
    var info = list.length + (list.length === 1 ? " perfume" : " perfumes");
    $("results-info").textContent = list.length ? "Mostrando " + slice.length + " de " + info : "";
  }

  function refresh(resetPage) {
    if (resetPage) state.shown = PAGE;
    renderChips();
    renderGrid();
  }

  /* ---------- modal de producto ---------- */
  var currentP = null, currentOpt = null, currentQty = 1;

  function notesHTML(n) {
    var rows = [["Salida", n.salida], ["Corazón", n.corazon], ["Fondo", n.fondo]].filter(function (r) { return r[1].length; });
    if (!rows.length) return "";
    return '<div class="notes"><h3>Notas olfativas</h3>' + rows.map(function (r) {
      return '<div class="note-row"><b>' + r[0] + '</b><span>' + esc(r[1].join(", ")) + '</span></div>';
    }).join("") + '</div>';
  }

  function factsHTML(p) {
    var f = [];
    if (p.incluye) f.push(["Incluye", p.incluye, true]);
    if (p.familia) f.push(["Familia olfativa", p.familia, true]);
    if (p.ideal_para) f.push(["Ideal para", p.ideal_para, true]);
    if (p.para) f.push(["Para", p.para]);
    if (p.contenido) f.push(["Contenido", p.contenido]);
    if (!f.length) return "";
    return '<dl class="facts">' + f.map(function (x) {
      return '<div' + (x[2] ? ' class="wide"' : "") + '><dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd></div>';
    }).join("") + '</dl>';
  }

  function openProduct(id) {
    var p = BY_ID[id]; if (!p) return;
    currentP = p; currentQty = 1;
    var av = availableOpts(p);
    currentOpt = av.length ? av[0].id : null;
    var out = isOut(p);

    var opts = p.opciones.map(function (o) {
      var dis = !o.disponible;
      return '<label class="opt' + (dis ? " off" : "") + '"><span class="opt-l"><input type="radio" name="opt" value="' + o.id + '"' +
        (o.id === currentOpt ? " checked" : "") + (dis ? " disabled" : "") + '>' + esc(o.label) + (dis ? " (agotado)" : "") +
        '</span><span class="price">' + money(o.price) + '</span></label>';
    }).join("");

    var buy = out
      ? '<div class="out-note"><p>Este perfume está agotado por ahora. Escríbenos y te avisamos cuando vuelva a estar disponible.</p>' +
        '<a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/' + WA + '?text=' + encodeURIComponent("Hola " + NEGOCIO + ", quiero saber cuándo vuelve a estar disponible: " + p.nombre) + '">Preguntar por WhatsApp</a></div>'
      : '<div class="buy-row"><div class="qty"><button type="button" id="q-minus" aria-label="Menos">&minus;</button><span id="q-val">1</span><button type="button" id="q-plus" aria-label="Más">+</button></div>' +
        '<button type="button" class="btn btn-dark" id="add-btn">Agregar al pedido</button></div>';

    $("modal-body").innerHTML =
      '<div class="m-img"><img src="' + img(p) + '" alt="' + esc(p.nombre) + '"></div>' +
      '<div class="m-info">' +
      '<p class="m-cat">' + esc(CAT_LABEL[p.categoria] || "") + '</p>' +
      '<h2 id="m-title">' + esc(p.nombre) + '</h2>' +
      (p.marca ? '<p class="m-brand">' + esc(p.marca) + '</p>' : "") +
      '<p class="m-desc">' + esc(p.descripcion) + '</p>' +
      notesHTML(p.notas) + factsHTML(p) +
      '<fieldset class="opts"><legend>Elige tu presentación</legend>' + opts + '</fieldset>' + buy +
      '</div>';
    $("overlay").hidden = false; $("modal").hidden = false;
    body.classList.add("no-scroll");
    $("modal").scrollTop = 0;
    var c = $("close-modal"); if (c) c.focus();
  }

  function closeModal() {
    $("modal").hidden = true;
    if ($("drawer").hidden) { $("overlay").hidden = true; body.classList.remove("no-scroll"); }
  }

  /* ---------- pedido ---------- */
  function saveCart() { try { localStorage.setItem("rafa_cart", JSON.stringify(cart)); } catch (e) {} }
  function loadCart() {
    try {
      var raw = JSON.parse(localStorage.getItem("rafa_cart") || "[]");
      cart = raw.filter(function (it) {
        var p = BY_ID[it.id]; return p && p.opciones.some(function (o) { return o.id === it.opt && o.disponible; });
      });
    } catch (e) { cart = []; }
  }
  function optOf(it) { return BY_ID[it.id].opciones.filter(function (o) { return o.id === it.opt; })[0]; }
  function total() { return cart.reduce(function (s, it) { return s + optOf(it).price * it.qty; }, 0); }

  function addToCart(id, opt, qty) {
    var f = cart.filter(function (it) { return it.id === id && it.opt === opt; })[0];
    if (f) f.qty += qty; else cart.push({ id: id, opt: opt, qty: qty });
    saveCart(); renderCart();
  }

  function renderCart() {
    var n = cart.reduce(function (s, it) { return s + it.qty; }, 0);
    $("cart-count").textContent = n;
    var box = $("cart-items");
    if (!cart.length) {
      box.innerHTML = '<div class="cart-empty"><p>Tu pedido está vacío.</p><p>Agrega perfumes desde el catálogo.</p></div>';
      $("cart-foot").hidden = true;
      return;
    }
    $("cart-foot").hidden = false;
    box.innerHTML = cart.map(function (it, i) {
      var p = BY_ID[it.id], o = optOf(it);
      return '<div class="cart-item"><div class="thumb"><img src="' + img(p) + '" alt=""></div>' +
        '<div><div class="ci-name">' + esc(p.nombre) + '</div><div class="ci-opt">' + esc(o.label) + ' · ' + money(o.price) + '</div>' +
        '<div class="ci-ctrl"><div class="qty"><button type="button" data-act="minus" data-i="' + i + '" aria-label="Menos">&minus;</button><span>' + it.qty +
        '</span><button type="button" data-act="plus" data-i="' + i + '" aria-label="Más">+</button></div>' +
        '<button type="button" class="ci-remove" data-act="del" data-i="' + i + '">Quitar</button></div></div>' +
        '<div class="ci-price">' + money(o.price * it.qty) + '</div></div>';
    }).join("");
    $("cart-total").textContent = money(total());
  }

  function openCart() {
    $("drawer").hidden = false; $("overlay").hidden = false; body.classList.add("no-scroll");
    $("modal").hidden = true;
    try { $("f-nombre").value = localStorage.getItem("rafa_nombre") || ""; $("f-ciudad").value = localStorage.getItem("rafa_ciudad") || ""; } catch (e) {}
  }
  function closeCart() {
    $("drawer").hidden = true;
    if ($("modal").hidden) { $("overlay").hidden = true; body.classList.remove("no-scroll"); }
  }

  function buildMessage() {
    var lines = ["Hola, " + NEGOCIO + " 👋", "Quiero hacer el siguiente pedido:", ""];
    cart.forEach(function (it, i) {
      var p = BY_ID[it.id], o = optOf(it);
      lines.push((i + 1) + ") " + p.nombre + " — " + o.label);
      lines.push("    " + it.qty + " x " + money(o.price) + " = " + money(o.price * it.qty));
    });
    lines.push("", "*Total: " + money(total()) + "*", "");
    var nombre = $("f-nombre").value.trim(), ciudad = $("f-ciudad").value.trim();
    if (nombre) lines.push("Nombre: " + nombre);
    if (ciudad) lines.push("Ciudad / barrio: " + ciudad);
    if (nombre || ciudad) lines.push("");
    lines.push("¿Me confirmas disponibilidad y forma de pago? ¡Gracias!");
    return lines.join("\n");
  }

  function sendWhatsApp() {
    if (!cart.length) return;
    try { localStorage.setItem("rafa_nombre", $("f-nombre").value); localStorage.setItem("rafa_ciudad", $("f-ciudad").value); } catch (e) {}
    window.open("https://wa.me/" + WA + "?text=" + encodeURIComponent(buildMessage()), "_blank", "noopener");
  }

  /* ---------- eventos ---------- */
  $("chips").addEventListener("click", function (e) {
    var b = e.target.closest(".chip"); if (!b) return;
    state.cat = b.dataset.cat; refresh(true);
  });
  $("search").addEventListener("input", function (e) { state.q = e.target.value; refresh(true); });
  $("sort").addEventListener("change", function (e) { state.sort = e.target.value; refresh(true); });
  $("clear-search").addEventListener("click", function () { state.q = ""; state.cat = "todos"; $("search").value = ""; refresh(true); });
  $("more").addEventListener("click", function () { state.shown += PAGE; renderGrid(); });
  $("grid").addEventListener("click", function (e) {
    var c = e.target.closest(".card"); if (c) openProduct(c.dataset.id);
  });

  $("modal").addEventListener("click", function (e) {
    if (e.target.closest("#close-modal")) return closeModal();
    if (e.target.id === "q-minus") { currentQty = Math.max(1, currentQty - 1); $("q-val").textContent = currentQty; }
    if (e.target.id === "q-plus") { currentQty = Math.min(20, currentQty + 1); $("q-val").textContent = currentQty; }
    if (e.target.id === "add-btn") {
      addToCart(currentP.id, currentOpt, currentQty);
      var btn = e.target; btn.textContent = "Agregado ✓";
      setTimeout(function () { btn.textContent = "Agregar al pedido"; }, 1400);
    }
  });
  $("modal").addEventListener("change", function (e) { if (e.target.name === "opt") currentOpt = e.target.value; });

  $("open-cart").addEventListener("click", openCart);
  $("close-cart").addEventListener("click", closeCart);
  $("overlay").addEventListener("click", function () { closeModal(); closeCart(); });
  $("cart-items").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-act]"); if (!b) return;
    var i = +b.dataset.i, it = cart[i]; if (!it) return;
    if (b.dataset.act === "plus") it.qty = Math.min(20, it.qty + 1);
    if (b.dataset.act === "minus") it.qty = Math.max(1, it.qty - 1);
    if (b.dataset.act === "del") cart.splice(i, 1);
    saveCart(); renderCart();
  });
  $("clear-cart").addEventListener("click", function () { cart = []; saveCart(); renderCart(); });
  $("send-wa").addEventListener("click", sendWhatsApp);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeModal(); closeCart(); } });

  /* ---------- inicio ---------- */
  loadCart(); renderCart(); refresh(true);
})();
