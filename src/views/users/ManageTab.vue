<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import type { AuditEntry, UserDetail } from '../../services/users'
import { dateTime, num } from './shared'

/**
 * Yönetim sekmesi.
 *
 * Buradaki her işlem geri alınması zor ya da imkânsız olduğu için hepsi onay
 * diyaloğundan geçer ve denetim defterine satır yazar. Yazma uçları Faz 2'de
 * geleceği için `writable` kapalıyken düğmeler akışı gösterir ve deftere
 * "prova" satırı düşer; sunucuya hiçbir şey gitmez.
 */
const props = defineProps<{ detail: UserDetail; writable: boolean; actor: string }>()
const emit = defineEmits<{ edit: []; audit: [AuditEntry] }>()

const toast = useToast()
const confirm = useConfirm()

const deleteConfirmation = ref('')
const xp = reactive({ amount: 0, reason: '' })
const questKey = ref('')

const questOptions = computed(() =>
  props.detail.gamification.quests.map((quest) => ({
    value: quest.key,
    label: `${quest.emoji} ${quest.title} (${String(quest.progress)}/${String(quest.target)})`,
  })))

const canDelete = computed(() =>
  deleteConfirmation.value.trim().toLocaleLowerCase('tr') === props.detail.profile.email.toLocaleLowerCase('tr'))

function record(action: string, detail: string) {
  emit('audit', {
    at: new Date().toISOString(),
    actor: props.actor,
    action: props.writable ? action : `${action} (prova)`,
    detail,
  })
  toast.add({
    severity: props.writable ? 'success' : 'info',
    summary: props.writable ? action : `${action} (prova)`,
    detail: props.writable ? detail : 'Yazma ucu açılmadığı için sunucuya gitmedi.',
    life: 3500,
  })
}

function resetOnboarding() {
  confirm.require({
    header: 'Tanışma akışını sıfırla',
    message: 'Kullanıcı uygulamayı bir sonraki açışında tanışma akışına düşer. Kaydettiği öğünler, ölçümler ve tecrübesi silinmez.',
    icon: 'pi pi-refresh',
    rejectLabel: 'Vazgeç',
    acceptLabel: 'Sıfırla',
    accept: () => record('Tanışma akışı sıfırlandı', props.detail.profile.email),
  })
}

function removeAccount() {
  confirm.require({
    header: 'Hesabı kalıcı olarak sil',
    message: `${props.detail.profile.email} hesabı ve tüm verisi (öğünler, ölçümler, Menüm, grup üyelikleri, tecrübe defteri) geri alınamaz biçimde silinecek. Kullanıcı bir grubun kurucusuysa grup en eski üyeye devredilir.`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Vazgeç',
    acceptLabel: 'Kalıcı olarak sil',
    acceptClass: 'p-button-danger',
    accept: () => {
      record('Hesap silindi', props.detail.profile.email)
      deleteConfirmation.value = ''
    },
  })
}

function adjustXp() {
  if (!xp.amount || !xp.reason.trim()) {
    toast.add({ severity: 'warn', summary: 'Miktar ve gerekçe gerekli', life: 3000 })
    return
  }
  confirm.require({
    header: 'Tecrübe düzeltmesi',
    message: `Deftere ${xp.amount > 0 ? '+' : ''}${String(xp.amount)} XP'lik bir düzeltme satırı yazılacak. Satır silinmez, yalnız karşıt bir düzeltmeyle dengelenir.`,
    icon: 'pi pi-pencil',
    rejectLabel: 'Vazgeç',
    acceptLabel: 'Deftere yaz',
    accept: () => {
      record('Tecrübe düzeltildi', `${xp.amount > 0 ? '+' : ''}${String(xp.amount)} XP · ${xp.reason.trim()}`)
      xp.amount = 0
      xp.reason = ''
    },
  })
}

function completeQuest() {
  const quest = props.detail.gamification.quests.find((row) => row.key === questKey.value)
  if (!quest) {
    toast.add({ severity: 'warn', summary: 'Önce bir görev seç', life: 3000 })
    return
  }
  confirm.require({
    header: 'Görevi tamamlanmış say',
    message: `"${quest.title}" görevi tamamlanmış işaretlenecek ve ödülü deftere yazılacak. Bu işlem kullanıcı ilerlemesini elle değiştirir; yalnız bir hata onarılırken kullanılmalı.`,
    icon: 'pi pi-check-circle',
    rejectLabel: 'Vazgeç',
    acceptLabel: 'Tamamlandı işaretle',
    accept: () => {
      record('Görev tamamlandı işaretlendi', quest.title)
      questKey.value = ''
    },
  })
}
</script>

<template>
  <div class="detail-body">
    <Message v-if="!writable" severity="warn" :closable="false">
      Yazma uçları henüz backend'de yok. Bu sekmedeki düğmeler onay akışını ve denetim defterini gösterir,
      sunucuya hiçbir şey yazmaz. Uçlar açıldığında tek değişiklik bu uyarının kalkması olacak.
    </Message>

    <section class="panel-card pad">
      <div class="panel-title sm"><div><p>PROFİL</p><h2>Bilgileri düzelt</h2></div></div>
      <p class="manage-copy">
        Görünen ad, kullanıcı adı, e-posta ve vücut alanları panelden düzeltilebilir. Kullanıcının
        kendi girdiği veriyi değiştirmek son çare olmalı; destek talebi olmadan dokunma.
      </p>
      <div class="card-foot">
        <Button label="Profili düzenle" icon="pi pi-pencil" outlined @click="emit('edit')" />
      </div>
    </section>

    <div class="split-grid">
      <article class="panel-card pad">
        <div class="panel-title sm"><div><p>HESAP</p><h2>Tanışma akışı</h2></div></div>
        <p class="manage-copy">
          Tanışma akışı yarım kalmış ya da yanlış doldurulmuş bir hesabı baştan başlatır.
          Veri silinmez; yalnız <code>onboarded_at</code> boşaltılır.
        </p>
        <dl class="fact-list">
          <div>
            <dt>Şu anki durum</dt>
            <dd>{{ detail.profile.onboardedAt ? `bitti · ${dateTime(detail.profile.onboardedAt)}` : 'bitmemiş' }}</dd>
          </div>
        </dl>
        <div class="card-foot">
          <Button label="Tanışma akışını sıfırla" icon="pi pi-refresh" severity="secondary" outlined @click="resetOnboarding" />
        </div>
      </article>

      <article class="panel-card pad danger">
        <div class="panel-title sm"><div><p>GERİ ALINAMAZ</p><h2>Hesabı sil</h2></div></div>
        <p class="manage-copy">
          Kullanıcının tüm verisi silinir. Uygulamadaki "hesabımı sil" ile aynı işlem;
          KVKK talebi ya da test hesabı temizliği dışında kullanma.
        </p>
        <div class="form-field">
          <label for="delete-confirm">Onaylamak için e-postayı yaz</label>
          <InputText id="delete-confirm" v-model="deleteConfirmation" fluid :placeholder="detail.profile.email" />
        </div>
        <div class="card-foot">
          <Button
            label="Hesabı kalıcı olarak sil"
            icon="pi pi-trash"
            severity="danger"
            :disabled="!canDelete"
            @click="removeAccount"
          />
        </div>
      </article>
    </div>

    <div class="split-grid">
      <article class="panel-card pad">
        <div class="panel-title sm"><div><p>İLERLEME</p><h2>Tecrübe düzeltmesi</h2></div></div>
        <p class="manage-copy">
          Tecrübe davranıştan doğar; buradan yazılan satır bir istisnadır ve deftere
          <strong>admin düzeltmesi</strong> kaynağıyla düşer. Eksi değer de yazılabilir.
        </p>
        <div class="form-grid">
          <div class="form-field span-2">
            <label for="xp-amount">Miktar</label>
            <InputNumber id="xp-amount" v-model="xp.amount" suffix=" XP" :min="-5000" :max="5000" fluid show-buttons />
          </div>
          <div class="form-field span-2">
            <label for="xp-reason">Gerekçe *</label>
            <InputText id="xp-reason" v-model="xp.reason" fluid placeholder="Örn. 12 Tem'de kaybolan hafta ödülü" />
          </div>
        </div>
        <div class="card-foot">
          <span class="muted-status">Toplam {{ num(detail.gamification.progress.totalXp) }} XP</span>
          <Button label="Deftere yaz" icon="pi pi-plus" outlined @click="adjustXp" />
        </div>
      </article>

      <article class="panel-card pad">
        <div class="panel-title sm"><div><p>İLERLEME</p><h2>Görev onarımı</h2></div></div>
        <p class="manage-copy">
          Sayacı takılmış bir görevi tamamlanmış saymak için. Ödül tecrübe defterine
          görevin kendi ödülüyle yazılır.
        </p>
        <div class="form-field">
          <label>Görev</label>
          <Select
            v-model="questKey"
            :options="questOptions"
            option-label="label"
            option-value="value"
            placeholder="Görev seç"
            fluid
          />
        </div>
        <div class="card-foot">
          <Button label="Tamamlandı işaretle" icon="pi pi-check-circle" outlined @click="completeQuest" />
        </div>
      </article>
    </div>

    <section class="panel-card pad">
      <div class="panel-title sm">
        <div><p>DENETİM</p><h2>Panelden yapılan işlemler</h2></div>
        <span class="result-count">{{ num(detail.audit.length) }} kayıt</span>
      </div>
      <ul v-if="detail.audit.length" class="audit-list">
        <li v-for="(entry, index) in detail.audit" :key="index">
          <span class="audit-dot" />
          <div>
            <strong>{{ entry.action }}</strong>
            <small>{{ entry.detail }}</small>
          </div>
          <span class="audit-meta">{{ entry.actor }} · {{ dateTime(entry.at) }}</span>
        </li>
      </ul>
      <p v-else class="muted-status">Bu kullanıcı üzerinde panelden yapılmış bir işlem yok.</p>
    </section>
  </div>
</template>
