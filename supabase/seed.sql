-- The migration includes the initial catalog for remote projects.
-- Keep this file available for `supabase db reset` in local development.
insert into public.exercises (name, muscle_group) values
  ('ベンチプレス', '胸'),
  ('インクラインダンベルプレス', '胸'),
  ('チェストプレス', '胸'),
  ('ダンベルフライ', '胸'),
  ('スクワット', '脚'),
  ('レッグプレス', '脚'),
  ('レッグエクステンション', '脚'),
  ('レッグカール', '脚'),
  ('デッドリフト', '背中'),
  ('ラットプルダウン', '背中'),
  ('シーテッドロー', '背中'),
  ('懸垂', '背中'),
  ('ショルダープレス', '肩'),
  ('サイドレイズ', '肩'),
  ('リアレイズ', '肩'),
  ('ダンベルカール', '腕'),
  ('バーベルカール', '腕'),
  ('トライセプスプッシュダウン', '腕'),
  ('ディップス', '腕'),
  ('クランチ', '腹筋')
on conflict (name) do nothing;
