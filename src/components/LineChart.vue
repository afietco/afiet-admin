<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Responsive SVG çizgi grafiği. viewBox kapsayıcının GERÇEK piksel ölçüsünden
 * hesaplanır (ResizeObserver); ölçekleme yok, bu yüzden hiçbir genişlikte
 * yazı/çizgi bozulması olmaz. Crosshair + tek tooltip tüm serileri okur.
 */
type Series = { label: string; color: string; values: number[] }

const props = withDefaults(
  defineProps<{
    /** X kategorileri (ör. kısa tarih). series[i].values ile aynı uzunlukta. */
    labels: string[]
    series: Series[]
    height?: number
    format?: (n: number) => string
  }>(),
  { height: 220, format: (n: number) => n.toLocaleString('tr-TR') },
)

const host = ref<HTMLElement | null>(null)
const width = ref(0)
let ro: ResizeObserver | null = null
onMounted(() => {
  ro = new ResizeObserver((entries) => {
    width.value = Math.round(entries[0]?.contentRect.width ?? 0)
  })
  if (host.value) ro.observe(host.value)
})
onBeforeUnmount(() => ro?.disconnect())

const PAD_TOP = 12
const PAD_BOTTOM = 24
const PAD_RIGHT = 10

const yMax = computed(() => {
  const raw = Math.max(1, ...props.series.flatMap((s) => s.values))
  // "Güzel" tavan: 1-2-5 basamakları
  const pow = 10 ** Math.floor(Math.log10(raw))
  for (const m of [1, 2, 5, 10]) if (raw <= m * pow) return m * pow
  return 10 * pow
})

// Çeyrek çizgiler hep çizilir; kesirli değere denk gelen ETİKET yazılmaz
// (2,5'i "3" diye yuvarlayıp yanlış hizada göstermekten iyidir).
const yTicks = computed(() =>
  [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = yMax.value * f
    return { value: v, label: Number.isInteger(v) ? props.format(v) : '' }
  }),
)

// Sol kenar payı en uzun y etiketine göre (11px fontta ~6.5px/karakter)
const padLeft = computed(() => {
  const longest = Math.max(...yTicks.value.map((t) => t.label.length))
  return Math.max(30, longest * 6.5 + 12)
})

const plotW = computed(() => Math.max(0, width.value - padLeft.value - PAD_RIGHT))
const plotH = computed(() => props.height - PAD_TOP - PAD_BOTTOM)
const n = computed(() => props.labels.length)
const stepX = computed(() => (n.value > 1 ? plotW.value / (n.value - 1) : 0))

function xAt(i: number): number {
  return n.value > 1 ? padLeft.value + i * stepX.value : padLeft.value + plotW.value / 2
}
function yAt(v: number): number {
  return PAD_TOP + plotH.value * (1 - v / yMax.value)
}

const paths = computed(() =>
  props.series.map((s) => ({
    ...s,
    d: s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' '),
  })),
)

// Uzun serilerde her etiketi göstermek kalabalık yapar: ~8 etikete indir.
const labelEvery = computed(() => Math.max(1, Math.ceil(n.value / 8)))
const xLabels = computed(() =>
  props.labels
    .map((text, i) => ({ text, i, x: xAt(i) }))
    .filter(({ i }) => i % labelEvery.value === 0 || i === n.value - 1)
    // Son etiket bir öncekine yapışıyorsa öncekini bırak, sonuncuyu koru
    .filter(({ i }, idx, arr) => !(idx < arr.length - 1 && arr[arr.length - 1].i - i < labelEvery.value / 2 && i !== 0)),
)

// ── Hover katmanı ────────────────────────────────────────────────────────────
const hoverIdx = ref<number | null>(null)
function onMove(ev: PointerEvent) {
  if (!host.value || n.value === 0) return
  const rect = host.value.getBoundingClientRect()
  const px = ev.clientX - rect.left
  const i = n.value > 1 ? Math.round((px - padLeft.value) / stepX.value) : 0
  hoverIdx.value = Math.min(n.value - 1, Math.max(0, i))
}
function onLeave() {
  hoverIdx.value = null
}

const tooltip = computed(() => {
  const i = hoverIdx.value
  if (i === null || !width.value) return null
  const x = xAt(i)
  const flip = x > width.value - 150
  return {
    i,
    x,
    flip,
    label: props.labels[i],
    rows: props.series.map((s) => ({ label: s.label, color: s.color, value: props.format(s.values[i] ?? 0) })),
  }
})

const empty = computed(() => n.value === 0 || props.series.every((s) => s.values.every((v) => !v)))
</script>

<template>
  <div ref="host" class="lc" :style="{ height: `${height}px` }" @pointermove="onMove" @pointerleave="onLeave">
    <svg v-if="width > 0" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="img">
      <!-- Sessiz ızgara + y etiketleri -->
      <g v-for="t in yTicks" :key="t.value">
        <line :x1="padLeft" :x2="width - PAD_RIGHT" :y1="yAt(t.value)" :y2="yAt(t.value)" class="lc-grid" />
        <text v-if="t.label" :x="padLeft - 8" :y="yAt(t.value) + 3.5" class="lc-tick" text-anchor="end">{{ t.label }}</text>
      </g>

      <!-- X etiketleri (son etiket kenardan taşmasın diye sağa yaslanır) -->
      <text v-for="l in xLabels" :key="l.i" :x="l.x" :y="height - 6" class="lc-tick" :text-anchor="l.i === n - 1 ? 'end' : 'middle'">{{ l.text }}</text>

      <!-- Crosshair -->
      <line v-if="tooltip" :x1="tooltip.x" :x2="tooltip.x" :y1="PAD_TOP" :y2="PAD_TOP + plotH" class="lc-cross" />

      <!-- Seriler -->
      <path v-for="s in paths" :key="s.label" :d="s.d" fill="none" :stroke="s.color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />

      <!-- Hover noktaları: 8px işaret + kağıt halkası -->
      <g v-if="tooltip">
        <circle v-for="s in series" :key="s.label" :cx="tooltip.x" :cy="yAt(s.values[tooltip.i] ?? 0)" r="4" :fill="s.color" class="lc-dot" />
      </g>
    </svg>

    <div v-if="empty" class="lc-empty">Bu aralıkta veri yok</div>

    <div v-if="tooltip && !empty" class="lc-tip" :style="tooltip.flip ? { right: `${width - tooltip.x + 10}px` } : { left: `${tooltip.x + 10}px` }">
      <p>{{ tooltip.label }}</p>
      <div v-for="r in tooltip.rows" :key="r.label" class="lc-tip-row">
        <span class="lc-key" :style="{ background: r.color }" />
        <strong>{{ r.value }}</strong>
        <span class="lc-name">{{ r.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lc { position: relative; width: 100%; touch-action: pan-y; }
.lc-grid { stroke: var(--line, #e5dfd1); stroke-opacity: 0.55; stroke-width: 1; }
.lc-tick { fill: var(--muted, #76786f); font-size: 10px; font-weight: 700; }
.lc-cross { stroke: #b6b8ae; stroke-width: 1; stroke-dasharray: 3 3; }
.lc-dot { stroke: var(--paper, #fffdf8); stroke-width: 2; }
.lc-empty { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted, #76786f); font-size: 12px; font-weight: 700; }
.lc-tip { position: absolute; top: 8px; z-index: 5; background: #fff; border: 1px solid var(--line, #e5dfd1); border-radius: 12px; box-shadow: 0 8px 22px rgba(41, 45, 41, 0.12); padding: 8px 12px; pointer-events: none; min-width: 120px; }
.lc-tip p { margin: 0 0 5px; color: var(--muted, #76786f); font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
.lc-tip-row { display: flex; align-items: center; gap: 7px; padding: 1.5px 0; }
.lc-tip-row strong { color: var(--ink, #292d29); font-size: 13px; }
.lc-key { width: 12px; height: 3px; border-radius: 2px; flex: none; }
.lc-name { color: var(--muted, #76786f); font-size: 11px; font-weight: 600; }
</style>
