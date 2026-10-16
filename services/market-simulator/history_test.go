package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"
)

func TestHistoryDeterminismAndOverlappingRanges(t *testing.T) {
	from := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	to := from.AddDate(0, 0, 40)
	a, e := GenerateHistory("ALPHA", from, to)
	if e != nil {
		t.Fatal(e)
	}
	b, _ := GenerateHistory("ALPHA", from.AddDate(0, 0, 20), to)
	if !reflect.DeepEqual(a[20:], b) {
		t.Fatal("overlapping fixtures differ")
	}
	for _, c := range a {
		if c.High < c.Open || c.High < c.Close || c.Low > c.Open || c.Low > c.Close || c.Volume <= 0 {
			t.Fatal(c)
		}
	}
	if _, e = GenerateHistory("UNKNOWN", from, to); e == nil {
		t.Fatal("unknown symbol accepted")
	}
	if _, e = GenerateHistory("ALPHA", from, from.AddDate(2, 0, 0)); e == nil {
		t.Fatal("unbounded request")
	}
}

func TestHistoryHttpContract(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/history?symbol=ALPHA&from=2025-01-01&to=2025-01-04", nil)
	res := httptest.NewRecorder()
	historyHandler(res, req)
	if res.Code != 200 {
		t.Fatal(res.Code, res.Body.String())
	}
	var body struct {
		Symbol  string   `json:"symbol"`
		Candles []Candle `json:"candles"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Symbol != "ALPHA" || len(body.Candles) != 3 {
		t.Fatal(body)
	}
	bad := httptest.NewRecorder()
	historyHandler(bad, httptest.NewRequest(http.MethodGet, "/history?symbol=ALPHA&from=bad&to=2025-01-04", nil))
	if bad.Code != 400 {
		t.Fatal("invalid date accepted")
	}
}
