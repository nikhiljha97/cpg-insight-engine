-- ============================================================
-- DuckDB Schema: Dunnhumby "The Complete Journey"
-- Retail Analytics Portfolio — CPG Proactive Insight Engine
-- ============================================================
-- Run order: execute this file once before loading any CSVs.
-- All tables are DROP + CREATE so re-running is safe.
-- ============================================================


-- ------------------------------------------------------------
-- 1. TRANSACTIONS
-- Core fact table. One row = one unique product in one basket.
-- ------------------------------------------------------------
DROP TABLE IF EXISTS transactions;
CREATE TABLE transactions (
    household_key   INTEGER,        -- Unique household ID
    basket_id       BIGINT,         -- Groups all items in one shopping trip
    day             INTEGER,        -- Day number (1 = first day in dataset)
    product_id      BIGINT,         -- Foreign key → products.product_id
    quantity        INTEGER,        -- Units purchased
    sales_value     DECIMAL(10,2),  -- Dollar amount (after discounts)
    store_id        INTEGER,        -- Store where purchase occurred
    retail_disc     DECIMAL(10,2),  -- Discount from retailer (negative = saving)
    trans_time      INTEGER,        -- Time of transaction (HHMM integer)
    week_no         INTEGER,        -- Week number within the 2-year span (1–104)
    coupon_disc     DECIMAL(10,2),  -- Discount from manufacturer coupon
    coupon_match_disc DECIMAL(10,2) -- Discount from coupon + retailer match
);

-- ------------------------------------------------------------
-- 2. PRODUCTS
-- Product dimension. Maps product_id to hierarchy labels.
-- ------------------------------------------------------------
DROP TABLE IF EXISTS products;
CREATE TABLE products (
    product_id          BIGINT PRIMARY KEY,
    manufacturer        INTEGER,        -- Manufacturer code
    department          VARCHAR(50),    -- e.g. "GROCERY", "MEAT", "PRODUCE"
    brand               VARCHAR(20),    -- "National" or "Private"
    commodity_desc      VARCHAR(100),   -- e.g. "SOFT DRINKS", "CHEESE"
    sub_commodity_desc  VARCHAR(100),   -- e.g. "COLA CARBONATED", "SHREDDED"
    curr_size_of_product VARCHAR(20)    -- e.g. "12 OZ", "1 LB"
);

-- ------------------------------------------------------------
-- 3. HOUSEHOLDS (Demographics)
-- One row per household that opted into the demographic survey.
-- ~800 of the 2,500 households have demographic data.
-- ------------------------------------------------------------
DROP TABLE IF EXISTS households;
-- Column order matches hh_demographic.csv (household_key is last in the file).
CREATE TABLE households (
    age_desc        VARCHAR(20),    -- e.g. "25-34", "45-54"
    marital_status_code VARCHAR(5), -- "A"=Married, "B"=Single, "U"=Unknown
    income_desc     VARCHAR(30),    -- e.g. "35-49K", "100-124K"
    homeowner_desc  VARCHAR(30),    -- e.g. "Homeowner", "Renter"
    hh_comp_desc    VARCHAR(50),    -- Household composition e.g. "2 Adults No Kids"
    household_size_desc VARCHAR(5), -- "1", "2", "3", "4", "5+"
    kid_category_desc VARCHAR(20),  -- "None/Unknown", "1", "2", "3+"
    household_key   INTEGER PRIMARY KEY
);

-- ------------------------------------------------------------
-- 4. CAMPAIGNS
-- Which campaign was targeted at which household.
-- ------------------------------------------------------------
DROP TABLE IF EXISTS campaign_table;
CREATE TABLE campaign_table (
    description     VARCHAR(5),     -- Campaign type: "A", "B", or "C"
    household_key   INTEGER,        -- Foreign key → households.household_key
    campaign        INTEGER         -- Campaign number
);

-- ------------------------------------------------------------
-- 5. CAMPAIGN DESCRIPTIONS
-- Maps campaign number to its date range.
-- ------------------------------------------------------------
DROP TABLE IF EXISTS campaign_desc;
-- Column order matches campaign_desc.csv (DESCRIPTION precedes CAMPAIGN in the file).
CREATE TABLE campaign_desc (
    description     VARCHAR(5),     -- "TypeA", "TypeB", "TypeC"
    campaign        INTEGER PRIMARY KEY,
    start_day       INTEGER,        -- Day campaign started
    end_day         INTEGER         -- Day campaign ended
);

-- ------------------------------------------------------------
-- 6. COUPONS
-- Maps coupon UIDs to which products and campaigns they cover.
-- ------------------------------------------------------------
DROP TABLE IF EXISTS coupons;
CREATE TABLE coupons (
    coupon_upc      BIGINT,         -- Coupon barcode / UPC
    product_id      BIGINT,         -- Foreign key → products.product_id
    campaign        INTEGER         -- Foreign key → campaign_desc.campaign
);

-- ------------------------------------------------------------
-- 7. COUPON REDEMPTIONS
-- Tracks which household redeemed which coupon on which day.
-- ------------------------------------------------------------
DROP TABLE IF EXISTS coupon_redempt;
CREATE TABLE coupon_redempt (
    household_key   INTEGER,
    day             INTEGER,
    coupon_upc      BIGINT,
    campaign        INTEGER
);

-- ============================================================
-- INDEXES — DuckDB is columnar so these are lightweight hints
-- ============================================================
-- (DuckDB auto-creates zone maps; explicit indexes rarely needed,
--  but these help on large joins)
CREATE INDEX IF NOT EXISTS idx_trans_basket    ON transactions(basket_id);
CREATE INDEX IF NOT EXISTS idx_trans_product   ON transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_trans_household ON transactions(household_key);
CREATE INDEX IF NOT EXISTS idx_trans_week      ON transactions(week_no);
