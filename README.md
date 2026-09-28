# Harbor Financial Wellness

A fictional financial planning application designed as a hands-on SDET portfolio project. The React UI connects to a FastAPI service. No real customer data, Fidelity branding, or internal code is included.

## Run locally

You need Node.js 20+ and Python 3.10+.

**Terminal 1 — API**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

**Terminal 2 — React**

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to FastAPI on port 8000. Start both servers for the dashboard to load.

## What works

- Sign-in with 120 independent fictional accounts (`user001`–`user120`). Password for account `userNNN` is `DemoPass!NNN`, such as `DemoPass!001`. These are intentionally public demo credentials, not production authentication.
- Open multiple workspace tabs from the side navigation or New tab dropdown. Tabs can be switched and closed, including duplicate views and an empty workspace.
- Overview tab with net worth, income/expenses chart, 6/12 month dropdown, recommendations, and goal cards.
- Goals tab with category dropdown and editable monthly contribution and target date.
- Activity tab with date range calendars and filtered activity.
- FastAPI endpoints: `/api/health`, `/api/demo-users`, `POST /api/auth/login`, `POST /api/auth/logout`, `/api/profile`, `/api/overview`, `/api/goals`, `PATCH /api/goals/{id}`, `/api/recommendations`, `/api/activity`. Protected requests use `Authorization: Bearer <accessToken>`.
- Loading, empty, error, and save confirmation states; responsive layout.

Goal updates and sessions are stored **in memory** and reset when the API restarts. Activity and charts are fictional fixtures. The date range deliberately covers sample entries in August and September 2026, so you can assert both populated and empty states. The sign-in flow is for local test practice, with predictable public credentials and no database. Do not deploy it as a real financial service.

## Suggested Playwright starting points

1. Assert that Overview loads from the API, then switch the chart dropdown to six months.
2. Filter Goals to Savings; edit Emergency fund; verify the updated monthly contribution in both Goals and Overview.
3. Change Activity dates to an empty range and assert the empty state, then select a range containing a deposit.
4. Intercept `/api/recommendations` or `/api/goals` to exercise error and loading states.
5. Run the same flows at desktop and mobile viewport sizes, including the mobile menu.
6. Open two Goals tabs, close one, switch back to the other, and verify the active view. Close all tabs and open another from the empty workspace.
7. Run workers under separate accounts (`user001` to `user100`) and verify a goal changed by one user does not change another user's goal.

For 100 parallel workers, assign the account by worker index (for example `user${String(workerIndex + 1).padStart(3, '0')}`). There are 20 spare accounts. Within a worker, restore mutated values with another PATCH or restart the API between suites. The in-memory service is useful for local functional concurrency, but use a persistent datastore and a real deployment when testing CI at substantial scale.
