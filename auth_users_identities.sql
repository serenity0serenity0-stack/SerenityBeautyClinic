--
-- PostgreSQL database dump
--

\restrict 0VqSRWsE4kNlvpvpaAdNHdcTZxdtJAvFeT9PZcd8ZYJo0IFZNNqfVTUEPvoATmp

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11 (Debian 17.11-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) FROM stdin;
00000000-0000-0000-0000-000000000000	004fe9d5-6b11-44c3-bc92-cb5ba29e13cc	authenticated	authenticated	malak@gmail.com	$2a$06$IQjqASWBjvfFv15QGCSo6.7QxctjWwq0JdlLfyjysMvsuO.BiKjwq	2026-10-01 11:18:15.61057+00	\N		\N		\N			\N	2026-10-02 10:25:11.750461+00	{"provider": "email", "providers": ["email"]}	{}	\N	2026-10-01 11:18:15.61057+00	2026-10-02 12:02:43.179541+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	9f5e14e9-67f8-4a7e-8322-41abfdacda0d	authenticated	authenticated	hana@gmail.com	$2a$06$6WZV0/2xh3mDPqT7QkrE9.Lpavrrz5Ml1WZI4FrpQlNDQ00X1hW0W	2026-08-05 01:23:40.924548+00	\N		\N		\N			\N	2026-09-02 11:33:03.668814+00	{"provider": "email", "providers": ["email"]}	{}	\N	2026-08-05 01:23:40.924548+00	2026-09-02 11:33:03.906289+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	9bf6605a-db64-4024-9245-f23ef16cae37	authenticated	authenticated	serenity0serenity0@gmail.com	$2a$10$Jwjw6K/YMLbL8jfN0J1p/.Rvt7SNio8pABgZgqG1rtT2zwjycPmnS	2026-03-25 02:26:40.623646+00	\N		\N		\N			\N	2026-10-02 10:51:14.051005+00	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-03-25 02:26:40.599789+00	2026-10-02 10:51:14.085238+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	b21095d6-fa21-4196-ba95-a1315c65fcaf	authenticated	authenticated	nour@gmail.com	$2a$06$e8ancL90cOmjfgSplGtydu7XqGbYTTPiTcc8ZEjoToTcTrkdU2rS.	2026-10-01 07:39:48.920342+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{}	\N	2026-10-01 07:39:48.920342+00	2026-10-01 07:39:48.920342+00	\N	\N			\N		0	\N		\N	f	\N	f
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id) FROM stdin;
9bf6605a-db64-4024-9245-f23ef16cae37	9bf6605a-db64-4024-9245-f23ef16cae37	{"sub": "9bf6605a-db64-4024-9245-f23ef16cae37", "email": "serenity0serenity0@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-03-25 02:26:40.611658+00	2026-03-25 02:26:40.612654+00	2026-03-25 02:26:40.612654+00	27f2d36c-f094-4b94-b6f3-8fcacec24974
9f5e14e9-67f8-4a7e-8322-41abfdacda0d	9f5e14e9-67f8-4a7e-8322-41abfdacda0d	{"sub": "9f5e14e9-67f8-4a7e-8322-41abfdacda0d", "email": "hana@gmail.com", "email_verified": true}	email	2026-08-05 01:23:40.924548+00	2026-08-05 01:23:40.924548+00	2026-08-05 01:23:40.924548+00	9f5e14e9-67f8-4a7e-8322-41abfdacda0d
b21095d6-fa21-4196-ba95-a1315c65fcaf	b21095d6-fa21-4196-ba95-a1315c65fcaf	{"sub": "b21095d6-fa21-4196-ba95-a1315c65fcaf", "email": "nour@gmail.com", "email_verified": true}	email	2026-10-01 07:39:48.920342+00	2026-10-01 07:39:48.920342+00	2026-10-01 07:39:48.920342+00	b21095d6-fa21-4196-ba95-a1315c65fcaf
004fe9d5-6b11-44c3-bc92-cb5ba29e13cc	004fe9d5-6b11-44c3-bc92-cb5ba29e13cc	{"sub": "004fe9d5-6b11-44c3-bc92-cb5ba29e13cc", "email": "malak@gmail.com", "email_verified": true}	email	2026-10-01 11:18:15.61057+00	2026-10-01 11:18:15.61057+00	2026-10-01 11:18:15.61057+00	004fe9d5-6b11-44c3-bc92-cb5ba29e13cc
\.


--
-- PostgreSQL database dump complete
--

\unrestrict 0VqSRWsE4kNlvpvpaAdNHdcTZxdtJAvFeT9PZcd8ZYJo0IFZNNqfVTUEPvoATmp

