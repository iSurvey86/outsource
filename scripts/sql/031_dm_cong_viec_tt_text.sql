-- Đổi cột tt sang text (giá trị kiểu I, II, I.1… từ ksnpsc)
ALTER TABLE "DM_CONG_VIEC" ALTER COLUMN "tt" TYPE text USING "tt"::text;
