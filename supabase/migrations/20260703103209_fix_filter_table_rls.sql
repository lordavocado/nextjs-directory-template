ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view categories" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated can insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Public can view labels" ON public.labels FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated can insert labels" ON public.labels FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Public can view tags" ON public.tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated can insert tags" ON public.tags FOR INSERT TO authenticated WITH CHECK (true);
