"""Locust load test: each virtual user logs in, then browses like a student.

Setup:  python loadtests/create_users.py 50
Run:    see loadtests/run_load_tests.ps1 (5, 10 and 25 users)

Login is throttled to 20/min per IP, so on_start retries on 429 -- keep the
spawn rate low (<= 0.3/s) so all users can log in without waiting long.
"""
import itertools
import random
import time

from locust import HttpUser, between, task

PASSWORD = "LoadTest!234"
_counter = itertools.count(1)
MAX_USERS = 50


class StudentUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        n = (next(_counter) - 1) % MAX_USERS + 1
        self.client.headers["Accept"] = "application/json"
        for _ in range(20):
            with self.client.post(
                "/api/auth/login/",
                json={"username": f"loadtest{n}", "password": PASSWORD},
                name="POST /api/auth/login/",
                catch_response=True,
            ) as resp:
                if resp.status_code == 200:
                    token = resp.json()["access"]
                    self.client.headers["Authorization"] = f"Bearer {token}"
                    return
                if resp.status_code == 429:  # throttled: expected, back off
                    resp.success()
                    time.sleep(10)
                    continue
                resp.failure(f"login failed: {resp.status_code}")
                self.stop()
                return
        self.stop()

    @task(3)
    def domains(self):
        self.client.get("/api/questions/domains/", name="GET /questions/domains/")

    @task(3)
    def questions(self):
        self.client.get("/api/questions/", name="GET /questions/")

    @task(2)
    def dashboard(self):
        self.client.get("/api/analytics/dashboard/", name="GET /analytics/dashboard/")

    @task(2)
    def study_domains(self):
        self.client.get("/api/study/domains/", name="GET /study/domains/")

    @task(1)
    def profile(self):
        self.client.get("/api/auth/me/", name="GET /auth/me/")

    @task(1)
    def resumable(self):
        self.client.get(
            "/api/questions/sessions/resumable/", name="GET /sessions/resumable/"
        )
