create policy "No browser access to AI audit"
on public.ai_request_events
for all
to anon, authenticated
using (false)
with check (false);
