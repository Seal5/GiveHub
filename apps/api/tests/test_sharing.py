from fastapi.testclient import TestClient


def test_share_page_renders_open_graph_preview(client: TestClient) -> None:
    item = client.get("/v1/opportunities").json()[0]
    response = client.get(f"/o/{item['id']}")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    body = response.text
    assert f'og:title" content="{item["title"]}"' in body
    assert f"givehub://opportunity/{item['id']}" in body
    assert item["organisation_name"] in body


def test_share_page_hides_unpublished_opportunities(client: TestClient) -> None:
    import uuid

    assert client.get(f"/o/{uuid.uuid4()}").status_code == 404


def test_share_page_needs_no_authentication(client: TestClient) -> None:
    from givehub.auth import current_identity
    from givehub.main import app

    item = client.get("/v1/opportunities").json()[0]
    app.dependency_overrides.pop(current_identity)
    try:
        assert client.get(f"/o/{item['id']}").status_code == 200
    finally:
        app.dependency_overrides.clear()
