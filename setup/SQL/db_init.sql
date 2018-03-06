CREATE table IF NOT EXISTS categories (page_title varchar(255) primary key, cat_subcats int, cat_files int, cl_to varchar(255)[], cat_level int[]);
CREATE table IF NOT EXISTS images (img_name varchar(255) primary key, img_user_text varchar(255), img_timestamp timestamp without time zone,img_size bigint,cl_to varchar(255)[],media_id serial unique,is_alive boolean);
CREATE table IF NOT EXISTS visualizations (media_id int references images(media_id), access_date date, accesses bigint, wm_accesses bigint, nwm_accesses bigint, primary key(media_id,access_date));
CREATE table IF NOT EXISTS usages (gil_wiki varchar(20),gil_page_title varchar(255),gil_to varchar(255), first_seen date,last_seen date, is_alive boolean, primary key(gil_to,gil_page_title,first_seen,gil_wiki));
CREATE INDEX IF NOT EXISTS ad_GBy on visualizations(access_date);
