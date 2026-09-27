-- Amazon Reviews 2023 (McAuley Lab) — All_Beauty + Amazon_Fashion
-- Foreign keys and indexes are added after the bulk load (see indexes.sql).
DROP TABLE IF EXISTS reviews, products, brands CASCADE;

CREATE TABLE brands (
    brand_id   int PRIMARY KEY,
    name       text NOT NULL
);
COMMENT ON TABLE brands IS 'Brand or store name selling products';

CREATE TABLE products (
    parent_asin     text PRIMARY KEY,
    title           text,
    category        text NOT NULL,
    main_category   text,
    brand_id        int,
    price_usd       numeric(10,2),
    average_rating  numeric(3,2),
    rating_count    int,
    sub_categories  text[],
    details         jsonb
);
COMMENT ON TABLE products IS 'Product catalog; parent_asin groups product variants';
COMMENT ON COLUMN products.category IS 'Source dataset: All_Beauty or Amazon_Fashion';
COMMENT ON COLUMN products.average_rating IS 'Average star rating shown on Amazon (1-5)';
COMMENT ON COLUMN products.rating_count IS 'Total number of ratings on Amazon';

CREATE TABLE reviews (
    review_id          bigserial PRIMARY KEY,
    parent_asin        text NOT NULL,
    asin               text,
    user_id            text,
    rating             smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title              text,
    body               text,
    helpful_votes      int NOT NULL DEFAULT 0,
    verified_purchase  boolean,
    reviewed_at        timestamptz
);
COMMENT ON TABLE reviews IS 'Customer reviews, one row per review';
COMMENT ON COLUMN reviews.rating IS 'Star rating given by the reviewer (1-5)';
