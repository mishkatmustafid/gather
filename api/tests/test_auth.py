def test_register_returns_user_without_password_hash(client):
    res = client.post("/auth/register", json={
        "email": "amira@example.com", "password": "password123", "display_name": "Amira",
    })

    assert res.status_code == 201
    body = res.json()
    assert body["email"] == "amira@example.com"
    assert body["display_name"] == "Amira"
    assert "password_hash" not in body
    assert "password" not in body


def test_register_duplicate_email_is_case_insensitive(client):
    user = {"email": "amira@example.com", "password": "password123", "display_name": "Amira"}
    assert client.post("/auth/register", json=user).status_code == 201

    res = client.post("/auth/register", json={**user, "email": "AMIRA@Example.com"})

    assert res.status_code == 409
    assert res.json()["error"]["code"] == "email_taken"


def test_wrong_password_and_unknown_email_look_identical(client, auth):
    auth("amira@example.com")

    wrong_pw = client.post("/auth/login", json={"email": "amira@example.com", "password": "not-it-at-all"})
    unknown = client.post("/auth/login", json={"email": "nobody@example.com", "password": "password123"})

    assert wrong_pw.status_code == unknown.status_code == 401
    assert wrong_pw.json() == unknown.json()
    assert wrong_pw.json()["error"]["code"] == "bad_credentials"