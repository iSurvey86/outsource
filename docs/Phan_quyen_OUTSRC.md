# OUTSRC - Ma tran phan quyen (thong nhat)

**Ngay:** 21/08/2026  
**Trang thai:** Da thong nhat nghiep vu + da enforce tren code UI (2026-08-21). Chay SQL `019_phan_quyen_ma_tran.sql` tren Supabase.

**Ky hieu:** `Co` = duoc phep | `Khong` = khong duoc phep  
(Tranh ky tu dac biet de khong loi font Word)

**Vai tro:** Admin (Ben B) | PM (Ben B) | Member (Ben B, du phong) | Ben A (viewer, gan theo du an)

**Cot loi:**
- Ben A: moi DA co `ben_a_user_ids` (mang nhieu user) - moi nguoi trong mang deu thay DA. Cot cu `ben_a_user_id` = phan tu dau.
- **Member = PM**, khac dung 1 diem: **Khong** xem tai chinh noi bo.

File Word: [Phan_quyen_OUTSRC_v2.docx](./Phan_quyen_OUTSRC_v2.docx) (ban Co/Khong, font Arial)

---

## 1. He thong & tai khoan

| Hang muc | Admin | PM | Member | Ben A |
|---|:---:|:---:|:---:|:---:|
| Quan ly he thong / nhat ky | Co | Khong | Khong | Khong |
| Tao / sua / xoa / khoa tai khoan | Co | Khong | Khong | Khong |

## 2. Du an (QLDA)

| Hang muc | Admin | PM | Member | Ben A |
|---|:---:|:---:|:---:|:---:|
| Xem danh sach DA | Moi DA | Moi DA | Moi DA (MVP) | Chi DA gan minh |
| Tao du an | Co | Khong | Khong | Khong |
| Sua metadata DA | Co | Khong | Khong | Khong |
| Doi gan Ben A sau tao | Co | Khong | Khong | Khong |
| Xoa du an | Co | Khong | Khong | Khong |
| Tao DA - chon Ben A | **Bat buoc + canh bao manh** | - | - | - |

## 3. Chi tiet du an (workspace)

| Hang muc | Admin | PM | Member | Ben A |
|---|:---:|:---:|:---:|:---:|
| TT co ban, Giao A, HD, GTV | Co | Xem | Xem | Xem (DA minh) |
| Khoi Khao sat (NVKS...) | Co | Lap/luu/xuat | Lap/luu/xuat (=PM) | An |
| Ho so chung | Co | Co + upload | Co + upload (=PM) | Chi xem |
| Upload ho so | Co | Co | Co (=PM) | Khong |
| Xoa file upload | Co (moi file) | Chi file minh up | Chi file minh up | Khong |

## 4. Tai chinh

| Hang muc | Admin | PM | Member | Ben A |
|---|:---:|:---:|:---:|:---:|
| So A-B | **Sua / nhan TU** | Chi xem | **Khong** | Chi xem (DA minh) |
| Tai chinh noi bo | Co (sua) | Chi xem | **Khong** | An |

## 5. HDSD / Co gi moi

| Admin | PM | Member | Ben A |
|:---:|:---:|:---:|:---:|
| Co | Co | Co | Co |

## 6. Tom tat theo vai tro

- **Admin:** Toan quyen (QLHT, DA, gan A, sua so A-B, noi bo, KS, ho so).
- **PM:** Khong QLHT; khong tao/sua/xoa DA; lap/luu/xuat KS; upload ho so; xem A-B; **xem** tai chinh noi bo (khong sua).
- **Member:** Giong PM; **Khong** sổ A↔B; **Khong** tai chinh noi bo.
- **Ben A:** Chi DA cua minh; xem TT co ban + Giao A + HD + GTV + Ho so; an KS; xem A-B (DA minh); khong noi bo; khong sua.
