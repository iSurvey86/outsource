-- OUTSRC 027: PM chỉ xem tài chính nội bộ; Admin giữ q_sua_chia_noi_bo
-- Chạy trên Supabase nếu đã apply 019 với PM q_sua_chia_noi_bo = 1

update phan_quyen
set q_sua_chia_noi_bo = 0
where phan_quyen = 'pm';
