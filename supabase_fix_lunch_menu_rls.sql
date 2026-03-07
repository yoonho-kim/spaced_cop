-- 점심 메뉴 테이블 RLS 수정용
-- 기존 policy가 `to authenticated` 로 생성된 경우
-- 현재 앱의 커스텀 로그인 구조에서는 insert/update/delete가 차단될 수 있습니다.

alter table if exists app_lunch_menu_items enable row level security;

drop policy if exists "app_lunch_menu_items_insert_authenticated" on app_lunch_menu_items;
drop policy if exists "app_lunch_menu_items_update_authenticated" on app_lunch_menu_items;
drop policy if exists "app_lunch_menu_items_delete_authenticated" on app_lunch_menu_items;

create policy "app_lunch_menu_items_insert_authenticated"
  on app_lunch_menu_items for insert
  with check (true);

create policy "app_lunch_menu_items_update_authenticated"
  on app_lunch_menu_items for update
  using (true)
  with check (true);

create policy "app_lunch_menu_items_delete_authenticated"
  on app_lunch_menu_items for delete
  using (true);
