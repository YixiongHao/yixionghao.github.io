/* Three capability curves - progressive enhancement.

   The accordion in the markup is rendered at build time by build-milestones.py
   and is the page's baseline: with JavaScript off, every milestone and every
   source is still reachable. This script reads the same data from the
   #tl-data JSON block and, when a domain section is at least RAIL_MIN wide,
   swaps the accordion for a horizontal rail whose nodes sit at their true
   dates.

   The width test is on the section's own box, not the viewport, so the rail
   still appears inside a constrained container and never silently vanishes in
   a split window. */
(function () {
  var RAIL_MIN = 620;          // px of container width
  var AXIS_PAD = [6, 94];      // rail occupies 6%-94% of its width

  var node = document.getElementById('tl-data');
  if (!node) return;

  var data;
  try {
    data = JSON.parse(node.textContent);
  } catch (e) {
    return;                    // leave the accordion in place
  }

  var months = function (s) {
    var p = s.split('-');
    return parseInt(p[0], 10) * 12 + (parseInt(p[1], 10) - 1);
  };
  var A0 = months(data.axis.start);
  var A1 = months(data.axis.end);

  function pos(ev) {
    var t = (ev.y * 12 + (ev.mo - 1) - A0) / (A1 - A0);
    t = Math.max(0, Math.min(1, t));
    return AXIS_PAD[0] + t * (AXIS_PAD[1] - AXIS_PAD[0]);
  }

  function pair(en, zh) {
    return '<span lang="en">' + en + '</span><span lang="zh">' + zh + '</span>';
  }

  function sourcesHTML(ev) {
    if (!ev.s || !ev.s.length) {
      return '<p class="tl-sources tl-pending">' + pair('Source pending', '来源待补') + '</p>';
    }
    var links = ev.s.map(function (s) {
      return '<a href="' + s[1] + '" target="_blank" rel="noopener">' + s[0] + '</a>';
    }).join(' ');
    return '<p class="tl-sources"><span class="tl-sources-label">' +
      pair('Sources', '来源') + '</span> ' + links + '</p>';
  }

  function panelHTML(d, ev) {
    var g = data.grades[ev.g];
    var tag = ev.placeholder
      ? '<p class="tl-grade tl-grade-placeholder">' +
          pair('PLACEHOLDER &mdash; not for publication', '占位内容 &mdash; 不可发布') + '</p>'
      : '<p class="tl-grade tl-grade-' + ev.g + '">' + pair(g.label, g.label_zh) + '</p>';
    return '<div class="tl-panel-in">' +
      '<p class="tl-panel-date">' + pair(ev.date, ev.date_zh) + '</p>' +
      '<p class="tl-panel-t">' + pair(ev.t, ev.t_zh) + '</p>' +
      tag +
      '<p class="tl-finding" lang="en">' + ev.f + '</p>' +
      '<p class="tl-finding" lang="zh">' + ev.f_zh + '</p>' +
      '<p class="tl-context" lang="en">' + ev.c + '</p>' +
      '<p class="tl-context" lang="zh">' + ev.c_zh + '</p>' +
      '<p class="tl-why" lang="en">' + ev.why + '</p>' +
      '<p class="tl-why" lang="zh">' + ev.why_zh + '</p>' +
      sourcesHTML(ev) +
      '</div>';
  }

  data.domains.forEach(function (d) {
    var section = document.querySelector('.tl-domain[data-domain="' + d.k + '"]');
    if (!section) return;
    var wrap = section.querySelector('.tl-rail-wrap');
    var hint = section.querySelector('.tl-hint');
    var panel = section.querySelector('.tl-panel');
    var accordion = section.querySelector('.tl-accordion');
    if (!wrap || !panel || !accordion) return;

    /* ---- accordion behaviour (always wired: it is the narrow-width form) ---- */
    accordion.querySelectorAll('.tl-acc-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var body = document.getElementById(btn.getAttribute('aria-controls'));
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        if (body) body.hidden = open;
      });
    });
    var lastAcc = accordion.querySelectorAll('.tl-acc-btn')[d.ev.length - 1];
    if (lastAcc) {
      lastAcc.setAttribute('aria-expanded', 'true');
      var lastBody = document.getElementById(lastAcc.getAttribute('aria-controls'));
      if (lastBody) lastBody.hidden = false;
    }

    /* ---- rail ---- */
    var html = ['<div class="tl-rail-line"></div>'];
    d.ev.forEach(function (ev, i) {
      var side = i % 2 === 0 ? 'above' : 'below';
      html.push(
        '<button type="button" class="tl-node" data-i="' + i + '" data-side="' + side + '"' +
        ' style="left:' + pos(ev).toFixed(2) + '%"' +
        ' aria-expanded="false" aria-controls="panel-' + d.k + '">' +
        '<span class="tl-node-mark"></span>' +
        '<span class="tl-node-stem"></span>' +
        '<span class="tl-node-label">' +
        '<span class="tl-node-date">' + pair(ev.date, ev.date_zh) + '</span>' +
        '<span class="tl-node-short">' + pair(ev.short, ev.short_zh) + '</span>' +
        '<span class="tl-dot" data-grade="' + (ev.placeholder ? 'ph' : ev.g) + '"></span>' +
        '</span></button>'
      );
    });
    wrap.innerHTML = html.join('');

    var nodes = wrap.querySelectorAll('.tl-node');
    var pinned = d.ev.length - 1;     // each rail loads with its most recent milestone pinned

    function show(i) {
      panel.innerHTML = panelHTML(d, d.ev[i]);
      nodes.forEach(function (n, j) {
        n.setAttribute('aria-expanded', j === i ? 'true' : 'false');
      });
    }

    nodes.forEach(function (n, i) {
      n.addEventListener('mouseenter', function () { show(i); });
      n.addEventListener('focus', function () { show(i); });
      n.addEventListener('click', function () { pinned = i; show(i); });
    });
    wrap.addEventListener('mouseleave', function () { show(pinned); });

    /* ---- pick a form, and keep picking as the container resizes ---- */
    var mode = null;
    function layout() {
      var next = section.clientWidth >= RAIL_MIN ? 'rail' : 'accordion';
      if (next === mode) return;
      mode = next;
      if (mode === 'rail') {
        wrap.hidden = false;
        panel.hidden = false;
        if (hint) hint.hidden = false;
        accordion.hidden = true;
        show(pinned);
      } else {
        wrap.hidden = true;
        panel.hidden = true;
        if (hint) hint.hidden = true;
        accordion.hidden = false;
      }
    }
    layout();

    if (window.ResizeObserver) {
      new ResizeObserver(layout).observe(section);
    } else {
      window.addEventListener('resize', layout);
    }
  });
})();
