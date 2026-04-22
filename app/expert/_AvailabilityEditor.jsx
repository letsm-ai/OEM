'use client'

import { useState } from 'react'
import { Save, Loader2, Plus, Trash2 } from 'lucide-react'
import { DAY_NAMES_AR } from '@/lib/experts'

export default function AvailabilityEditor({ initial = [] }) {
  // group existing by dayOfWeek
  const byDay = {}
  for (let d = 0; d < 7; d++) byDay[d] = []
  for (const a of initial) {
    byDay[a.dayOfWeek]?.push({ startTime: a.startTime, endTime: a.endTime })
  }
  const [schedule, setSchedule] = useState(byDay)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const addRange = (day) => {
    setSchedule((s) => ({
      ...s,
      [day]: [...(s[day] || []), { startTime: '09:00', endTime: '17:00' }],
    }))
  }
  const removeRange = (day, i) => {
    setSchedule((s) => ({
      ...s,
      [day]: s[day].filter((_, idx) => idx !== i),
    }))
  }
  const updateRange = (day, i, key, value) => {
    setSchedule((s) => ({
      ...s,
      [day]: s[day].map((r, idx) => (idx === i ? { ...r, [key]: value } : r)),
    }))
  }

  const save = async () => {
    setSaving(true)
    setSaved(false)
    const flat = []
    for (let d = 0; d < 7; d++) {
      for (const r of schedule[d] || []) {
        if (r.startTime && r.endTime && r.endTime > r.startTime) {
          flat.push({ dayOfWeek: d, ...r })
        }
      }
    }
    const res = await fetch('/api/experts/me/availability', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ availability: flat }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } else {
      alert('تعذر الحفظ')
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="mb-4 text-xs text-gray-500">
        حدّد الساعات المتاحة في كل يوم من الأسبوع. يمكنك إضافة عدة فترات لليوم الواحد.
      </p>
      <div className="space-y-3">
        {DAY_NAMES_AR.map((dayName, day) => (
          <div key={day} className="rounded-xl bg-[#F8F9FA] p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-bold text-[#1B3A6B]">{dayName}</div>
              <button
                onClick={() => addRange(day)}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus className="h-3 w-3" />
                إضافة فترة
              </button>
            </div>
            {(schedule[day] || []).length === 0 ? (
              <div className="text-xs text-gray-400">غير متاح</div>
            ) : (
              <div className="space-y-2">
                {schedule[day].map((r, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-500">من</span>
                    <input
                      type="time"
                      value={r.startTime}
                      onChange={(e) =>
                        updateRange(day, i, 'startTime', e.target.value)
                      }
                      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                    />
                    <span className="text-xs text-gray-500">إلى</span>
                    <input
                      type="time"
                      value={r.endTime}
                      onChange={(e) =>
                        updateRange(day, i, 'endTime', e.target.value)
                      }
                      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                    />
                    <button
                      onClick={() => removeRange(day, i)}
                      className="rounded-md p-1 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <div className="text-xs text-green-700">
          {saved && '✓ تم الحفظ بنجاح'}
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-5 py-2 text-sm font-semibold text-white hover:bg-[#152c52] disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> جاري الحفظ...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> حفظ الجدول
            </>
          )}
        </button>
      </div>
    </div>
  )
}
