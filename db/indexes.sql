-- Run after the bulk load.

-- Integrity
ALTER TABLE products ADD FOREIGN KEY (brand_id) REFERENCES brands (brand_id);
ALTER TABLE reviews ADD FOREIGN KEY (parent_asin) REFERENCES products (parent_asin);

-- Foreign keys / joins
CREATE INDEX ON products (brand_id);
CREATE INDEX ON reviews (parent_asin);

-- Common filters
CREATE INDEX ON products (category);
CREATE INDEX ON products (price_usd);
CREATE INDEX ON reviews (reviewed_at);
CREATE INDEX ON reviews (rating);
CREATE INDEX ON reviews (user_id);

-- Case-insensitive brand lookup
CREATE INDEX ON brands (lower(name));

-- Full-text search on review text; queries must use the same expression:
--   WHERE to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,''))
--         @@ plainto_tsquery('english', 'packaging')
CREATE INDEX ON reviews USING gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,'')));
