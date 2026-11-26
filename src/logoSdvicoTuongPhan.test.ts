// Ticket theme-03: logo SDVICO nhìn rõ ở cả chế độ sáng và chế độ tối.
// Đọc màu thật của chính file logo trong repo (giải mã PNG bằng API có sẵn của nền chạy, không gói
// thêm, không mạng) rồi tính tương phản với nền của theme sdvico bằng hàm tương phản của repo.
import { themes } from './astryx-themes'
import { docHex, tuongPhan, type Rgb } from './test/mau'

const LOGO = import.meta.glob('/src/assets/sdvico-logo.png', {
  query: '?inline',
  import: 'default',
  eager: true,
}) as Record<string, string>

interface AnhRgba {
  rong: number
  cao: number
  /** Điểm ảnh RGBA 8 bit, theo hàng. */
  diem: Uint8Array
}

function docSo32(b: Uint8Array, i: number): number {
  return ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0
}

async function giaiNen(du: Uint8Array): Promise<Uint8Array> {
  const luong = new Blob([du as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(luong).arrayBuffer())
}

/** Giải mã PNG RGBA 8 bit, không xen kẽ (đúng loại của file logo). */
async function giaiMaPng(dataUrl: string): Promise<AnhRgba> {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const nhiPhan = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  let i = 8
  let rong = 0
  let cao = 0
  const cacIdat: Uint8Array[] = []
  while (i < nhiPhan.length) {
    const dai = docSo32(nhiPhan, i)
    const loai = String.fromCharCode(...nhiPhan.slice(i + 4, i + 8))
    const du = nhiPhan.slice(i + 8, i + 8 + dai)
    if (loai === 'IHDR') {
      rong = docSo32(du, 0)
      cao = docSo32(du, 4)
      // Độ sâu 8 bit, kiểu màu 6 (RGBA), không xen kẽ.
      if (du[8] !== 8 || du[9] !== 6 || du[12] !== 0) throw new Error('Logo không còn là PNG RGBA 8 bit')
    }
    if (loai === 'IDAT') cacIdat.push(du)
    i += 12 + dai
  }
  const gop = new Uint8Array(cacIdat.reduce((n, d) => n + d.length, 0))
  let viTri = 0
  for (const d of cacIdat) {
    gop.set(d, viTri)
    viTri += d.length
  }
  const tho = await giaiNen(gop)
  const buoc = rong * 4
  const diem = new Uint8Array(cao * buoc)
  for (let y = 0; y < cao; y++) {
    const loc = tho[y * (buoc + 1)]
    const dau = y * (buoc + 1) + 1
    for (let x = 0; x < buoc; x++) {
      const a = x >= 4 ? diem[y * buoc + x - 4] : 0
      const b = y > 0 ? diem[(y - 1) * buoc + x] : 0
      const c = x >= 4 && y > 0 ? diem[(y - 1) * buoc + x - 4] : 0
      let du = 0
      if (loc === 1) du = a
      else if (loc === 2) du = b
      else if (loc === 3) du = (a + b) >> 1
      else if (loc === 4) {
        const p = a + b - c
        const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)]
        du = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      diem[y * buoc + x] = (tho[dau + x] + du) & 255
    }
  }
  return { rong, cao, diem }
}

function laDiemDac(anh: AnhRgba, x: number, y: number): boolean {
  return anh.diem[(y * anh.rong + x) * 4 + 3] >= 250
}

/**
 * Màu của chữ "SDVICO": khối hàng cuối cùng có điểm ảnh đặc (tách khỏi vòng tròn biểu tượng bởi
 * các hàng trong suốt), lấy màu đặc xuất hiện nhiều nhất trong khối đó.
 */
function mauChuSdvico(anh: AnhRgba): { mau: Rgb; soDiem: number; tuHang: number; denHang: number } {
  const coDiemDac = (y: number) => Array.from({ length: anh.rong }, (_, x) => x).some((x) => laDiemDac(anh, x, y))
  let denHang = anh.cao - 1
  while (denHang >= 0 && !coDiemDac(denHang)) denHang--
  let tuHang = denHang
  while (tuHang > 0 && coDiemDac(tuHang - 1)) tuHang--
  const dem = new Map<string, number>()
  for (let y = tuHang; y <= denHang; y++) {
    for (let x = 0; x < anh.rong; x++) {
      if (!laDiemDac(anh, x, y)) continue
      const k = (y * anh.rong + x) * 4
      const khoa = `${anh.diem[k]},${anh.diem[k + 1]},${anh.diem[k + 2]}`
      dem.set(khoa, (dem.get(khoa) ?? 0) + 1)
    }
  }
  const [khoa, soDiem] = [...dem].sort((a, b) => b[1] - a[1])[0]
  const [r, g, b] = khoa.split(',').map(Number)
  return { mau: [r, g, b], soDiem, tuHang, denHang }
}

type CheDo = 'sang' | 'toi'
const tokens = (themes.sdvico as unknown as { tokens: Record<string, string> }).tokens

function mauNen(token: string, cheDo: CheDo): Rgb {
  const giaTri = tokens[token]
  const m = /^light-dark\(\s*(#[0-9a-fA-F]{3,8})\s*,\s*(#[0-9a-fA-F]{3,8})\s*\)$/.exec(giaTri.trim())
  if (!m) return docHex(giaTri)
  return docHex(cheDo === 'sang' ? m[1] : m[2])
}

/**
 * Nền nằm ngay dưới logo: đầu khung ứng dụng (LayoutHeader trong suốt) nằm trên nền trang; màn
 * đăng nhập đặt logo trong Card (nền thẻ).
 */
const NEN_DUOI_LOGO = {
  'đầu khung ứng dụng (nền trang)': '--color-background-body',
  'màn đăng nhập (nền thẻ)': '--color-background-card',
} as const

/** Ngưỡng của spec cho thành phần giao diện và chữ lớn (logo là hình): 3 trên 1. */
const NGUONG = 3

describe('logo SDVICO nhìn rõ trên nền của cả hai chế độ', () => {
  it('file logo là PNG vuông 350 × 350, nền trong suốt, chữ "SDVICO" màu xanh dương ở đáy', async () => {
    const dataUrl = LOGO['/src/assets/sdvico-logo.png']
    expect(dataUrl).toMatch(/^data:image\/png;base64,/)
    const anh = await giaiMaPng(dataUrl)
    expect([anh.rong, anh.cao]).toEqual([350, 350])
    // Góc ảnh trong suốt: logo đi lên nền của theme, không mang nền riêng.
    expect(laDiemDac(anh, 0, 0)).toBe(false)
    const chu = mauChuSdvico(anh)
    expect(chu.tuHang).toBeGreaterThan(anh.cao / 2)
    expect(chu.soDiem).toBeGreaterThan(500)
    const [r, g, b] = chu.mau
    expect(b).toBeGreaterThan(r + 60)
    expect(b).toBeGreaterThan(g + 30)
  })

  for (const cheDo of ['sang', 'toi'] as const) {
    for (const [cho, token] of Object.entries(NEN_DUOI_LOGO)) {
      it(`chế độ ${cheDo === 'sang' ? 'sáng' : 'tối'}: chữ "SDVICO" của logo trên ${cho} đạt ít nhất ${NGUONG} trên 1`, async () => {
        const { mau } = mauChuSdvico(await giaiMaPng(LOGO['/src/assets/sdvico-logo.png']))
        expect(tuongPhan(mau, mauNen(token, cheDo))).toBeGreaterThanOrEqual(NGUONG)
      })
    }
  }
})
