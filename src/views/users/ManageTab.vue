<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { usersApi, type UserDetail } from '../../services/users'
import { dateTime, num } from './shared'

/**
 * Yönetim sekmesi.
 *
 * Buradaki her işlem geri alınması zor ya da imkânsız; hepsi onay
 * diyaloğundan geçer ve sunucuda denetim defterine satır yazar. Defteri de
 * aynı yanıttan okuyoruz, yani ekranda "yaptım" yazması sunucuda yazıldığı
 * anlamına gelir.
 */
const props = defineProps<{ detail: UserDetail; userId: string }>()
const emit = defineEmits<{ edit: []; changed: []; deleted: [] }>()

const toast = useToast()
const confirm = useConfirm()

const deleteConfirmation = ref('')
const xp = reactive({ amount: 0, reason: '' })
const questKey = ref('')
const busy = ref('')

const questOptions = computed(() =>
  props.detail.gamification.quests.map((quest) => ({
    value: quest.key,
    label: `${quest.emoji} ${quest.title} (${String(quest.progress)}/${String(quest.target)})`,
  })))

const canDelete = computed(() =>
  deleteConfirmation.value.trim().toLocaleLowerCase('tr') === props.detail.profile.email.toLocaleLowerCase('tr'))

/**
 * Ortak yürütücü: işlemi koşar, sonucu söyler, defteri tazeler.
 *
 * Tazeleme çağıranın işi değil: her yazma denetim defterine satır düşürüyor ve
 * ekran onu göstermezse "yazıldı mı" sorusu ekranda cevapsız kalıyor.
 */
async function run(key: string, action: string, work: () => Promise<unknown>) {
  busy.value = key
  try {
    await work()
    toast.add({ severity: 'success', summary: action, life: 3000 })
    emit('changed')
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: `${action}: olmadı`,
      detail: err instanceof Error ? err.message : '',
      life: 5000,
    })
  } finally {
    busy.value = ''
  }
}

function resetOnboarding() {
  confirm.require({
    header: 'Tanışma akışını sıfırla',
    message: 'Kullanıcı uygulamayı bir sonraki açışında tanışma akışına düşer. Kaydettiği öğünler, ölçümler ve tecrübesi silinmez.',
    icon: 'pi pi-refresh',
    rejectLabel: 'Vazgeç',
    acceptLabel: 'Sıfırla',
    accept: () => run('onboarding', 'Tanışma akışı sıfırlandı',
      () => usersApi.resetOnboarding(props.userId)),
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
    accept: async () => {
      busy.value = 'delete'
      try {
        await usersApi.deleteUser(props.userId, props.detail.profile.email)
        deleteConfirmation.value = ''
        toast.add({ severity: 'success', summary: 'Hesap silindi', life: 3000 })
        emit('deleted')
      } catch (err) {
        toast.add({
          severity: 'error', summary: 'Silinemedi',
          detail: err instanceof Error ? err.message : '', life: 5000,
        })
      } finally {
        busy.value = ''
      }
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
    accept: async () => {
      await run('xp', 'Tecrübe düzeltildi',
        () => usersApi.adjustXp(props.userId, xp.amount, xp.reason.trim()))
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
    accept: async () => {
      await run('quest', 'Görev tamamlandı işaretlendi',
        () => usersApi.completeQuest(props.userId, quest.key))
      questKey.value = ''
    },
  })
}
</script>

<template>
  <div class="detail-body">
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
          <Button
            label="Tanışma akışını sıfırla"
            icon="pi pi-refresh"
            severity="secondary"
            outlined
            :loading="busy === 'onboarding'"
            @click="resetOnboarding"
          />
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
            :loading="busy === 'delete'"
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
          <Button label="Deftere yaz" icon="pi pi-plus" outlined :loading="busy === 'xp'" @click="adjustXp" />
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
          <Button
            label="Tamamlandı işaretle"
            icon="pi pi-check-circle"
            outlined
            :loading="busy === 'quest'"
            @click="completeQuest"
          />
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
