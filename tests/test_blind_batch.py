import hashlib, json, sys

CONTRACT = "contracts/blind_batch.py"
RUBRIC_URL = "https://example.org/fund/rubric"
ALPHA_URL = "https://example.org/fund/alpha"
BETA_URL = "https://example.org/fund/beta"
RUBRIC = "Every proposal must include a working public prototype and a maintenance plan covering at least twelve months. Projects must be open source before final selection."
ALPHA = "Alpha has a working public prototype. The repository is open source. Our maintenance plan covers eighteen months after launch."
BETA = "Beta publishes a working public prototype and an open source repository. Its maintenance plan covers twelve months after launch."
JURORS = ["0x1111111111111111111111111111111111111111", "0x2222222222222222222222222222222222222222", "0x3333333333333333333333333333333333333333"]


def proposals():
    return json.dumps([{"id": "alpha", "title": "Alpha commons", "url": ALPHA_URL}, {"id": "beta", "title": "Beta relay", "url": BETA_URL}])


def screening(state="ADMIT"):
    alpha_first = "PASS" if state == "ADMIT" else "FAIL"
    def checks(name, prototype, months, source, first="PASS"):
        return [
            {"index": 0, "state": first, "rubric_quote": "Every proposal must include a working public prototype", "proposal_quote": prototype if first == "PASS" else "", "explanation": "The public prototype gate is checked against direct proposal evidence."},
            {"index": 1, "state": "PASS", "rubric_quote": "a maintenance plan covering at least twelve months", "proposal_quote": months, "explanation": "The maintenance period meets the stated minimum."},
            {"index": 2, "state": "PASS", "rubric_quote": "Projects must be open source before final selection", "proposal_quote": source, "explanation": "The proposal provides direct open-source evidence."},
        ]
    return {"screening": [
        {"index": 0, "proposal_id": "alpha", "checks": checks("alpha", "Alpha has a working public prototype", "maintenance plan covers eighteen months", "repository is open source", alpha_first), "explanation": "Every mandatory rubric gate was evaluated for Alpha."},
        {"index": 1, "proposal_id": "beta", "checks": checks("beta", "Beta publishes a working public prototype", "maintenance plan covers twelve months", "open source repository"), "explanation": "Every mandatory rubric gate was evaluated for Beta."}
    ]}


def create(contract):
    return contract.create_round("public-goods-2030", "Public goods jury", "Screen proposals against public minimum gates, then rank the admitted batch with sealed juror preferences.", RUBRIC_URL, proposals(), json.dumps(JURORS))


def enable_consensus(contract, monkeypatch, validator=None):
    module = sys.modules[contract.__class__.__module__]
    monkeypatch.setattr(module.gl.eq_principle, "strict_eq", lambda fn: fn())
    monkeypatch.setattr(module.gl.eq_principle, "prompt_comparative", validator or (lambda fn, *_args, **_kwargs: fn()))


def mocks(vm, result=None):
    vm.mock_web(RUBRIC_URL, {"method": "GET", "status": 200, "body": RUBRIC})
    vm.mock_web(ALPHA_URL, {"method": "GET", "status": 200, "body": ALPHA})
    vm.mock_web(BETA_URL, {"method": "GET", "status": 200, "body": BETA})
    vm.mock_llm("BLINDBATCH_PRODUCER", json.dumps(json.dumps(result or screening())))


def commitment(round_id, ranking, salt):
    return hashlib.sha256((round_id + "|" + ",".join(ranking) + "|" + salt).encode()).hexdigest()


def test_contract_loads(direct_deploy):
    assert direct_deploy(CONTRACT) is not None


def test_rejects_invalid_jury_and_duplicate_round(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    with direct_vm.expect_revert("Three, five, or seven"):
        contract.create_round("bad-jury", "Bad jury", "This purpose is sufficiently detailed for the contract validation.", RUBRIC_URL, proposals(), json.dumps(JURORS[:2]))
    create(contract)
    with direct_vm.expect_revert("already exists"):
        create(contract)


def test_screening_binds_quotes_proposals_and_receipts(direct_vm, direct_deploy, monkeypatch):
    contract = direct_deploy(CONTRACT); enable_consensus(contract, monkeypatch); round_id = create(contract); mocks(direct_vm)
    result = contract.screen(round_id); direct_vm.clear_mocks()
    assert result["admitted"] == ["alpha", "beta"]
    assert len(result["source_receipts"]) == 3
    assert contract.get_round(round_id)["status"] == "COMMIT"


def test_forged_proposal_quote_fails_closed(direct_vm, direct_deploy, monkeypatch):
    contract = direct_deploy(CONTRACT); enable_consensus(contract, monkeypatch); round_id = create(contract)
    forged = screening(); forged["screening"][1]["checks"][0]["proposal_quote"] = "Beta has already received automatic funding"
    mocks(direct_vm, forged)
    with direct_vm.expect_revert("Proposal quote"):
        contract.screen(round_id)


def test_screen_requires_at_least_two_admitted_proposals(direct_vm, direct_deploy, monkeypatch):
    contract = direct_deploy(CONTRACT); enable_consensus(contract, monkeypatch); round_id = create(contract); mocks(direct_vm, screening("REJECT"))
    with direct_vm.expect_revert("At least two proposals"):
        contract.screen(round_id)


def test_commit_reveal_rejects_wrong_salt_and_finalizes_quorum(direct_vm, direct_deploy, monkeypatch):
    contract = direct_deploy(CONTRACT); enable_consensus(contract, monkeypatch); round_id = create(contract); mocks(direct_vm); contract.screen(round_id); direct_vm.clear_mocks()
    ranking_a, ranking_b = ["alpha", "beta"], ["beta", "alpha"]
    salts = ["juror-one-secret-2030", "juror-two-secret-2030", "juror-three-secret-2030"]
    for index, juror in enumerate(JURORS):
        direct_vm.sender = juror
        ranking = ranking_a if index != 1 else ranking_b
        contract.commit_ranking(round_id, commitment(round_id, ranking, salts[index]))
    direct_vm.sender = "0x9999999999999999999999999999999999999999"
    with direct_vm.expect_revert("round owner"):
        contract.close_commits(round_id)
    direct_vm.sender = contract.get_round(round_id)["owner"]
    assert contract.close_commits(round_id)["status"] == "REVEAL"
    direct_vm.sender = JURORS[0]
    with direct_vm.expect_revert("does not match"):
        contract.reveal_ranking(round_id, json.dumps(ranking_a), "wrong-secret-value")
    contract.reveal_ranking(round_id, json.dumps(ranking_a), salts[0])
    direct_vm.sender = JURORS[1]; contract.reveal_ranking(round_id, json.dumps(ranking_b), salts[1])
    result = contract.finalize(round_id)
    assert result["winner"] == "alpha" and result["reveals_counted"] == 2
    with direct_vm.expect_revert("quorum"):
        contract.finalize(round_id)


def test_non_juror_and_duplicate_commit_are_rejected(direct_vm, direct_deploy, monkeypatch):
    contract = direct_deploy(CONTRACT); enable_consensus(contract, monkeypatch); round_id = create(contract); mocks(direct_vm); contract.screen(round_id); direct_vm.clear_mocks()
    sealed = commitment(round_id, ["alpha", "beta"], "a-long-enough-secret")
    direct_vm.sender = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    with direct_vm.expect_revert("Juror cannot commit"):
        contract.commit_ranking(round_id, sealed)
    direct_vm.sender = JURORS[0]; contract.commit_ranking(round_id, sealed)
    with direct_vm.expect_revert("already recorded"):
        contract.commit_ranking(round_id, sealed)
