/**
 * 검색 웹 워커
 * 대용량 데이터 검색을 백그라운드에서 처리
 */

// 검색 데이터 캐시
let searchIndex = null;

/**
 * 메시지 핸들러
 */
self.onmessage = function(e) {
    const { type, data, id } = e.data;

    switch (type) {
        case 'INDEX':
            indexData(data, id);
            break;

        case 'SEARCH':
            search(data, id);
            break;

        case 'FILTER':
            filter(data, id);
            break;

        case 'SORT':
            sort(data, id);
            break;

        case 'AGGREGATE':
            aggregate(data, id);
            break;

        default:
            self.postMessage({
                id,
                error: `Unknown message type: ${type}`
            });
    }
};

/**
 * 데이터 인덱싱
 */
function indexData(data, id) {
    try {
        const { items, fields } = data;

        searchIndex = {
            items: items,
            fields: fields,
            tokens: new Map()
        };

        // 토큰 인덱스 생성
        items.forEach((item, index) => {
            fields.forEach(field => {
                const value = getNestedValue(item, field);
                if (value) {
                    const tokens = tokenize(String(value));
                    tokens.forEach(token => {
                        if (!searchIndex.tokens.has(token)) {
                            searchIndex.tokens.set(token, new Set());
                        }
                        searchIndex.tokens.get(token).add(index);
                    });
                }
            });
        });

        self.postMessage({
            id,
            result: {
                indexed: items.length,
                tokens: searchIndex.tokens.size
            }
        });
    } catch (error) {
        self.postMessage({ id, error: error.message });
    }
}

/**
 * 검색 실행
 */
function search(data, id) {
    try {
        const { query, options = {} } = data;
        const {
            limit = 50,
            fuzzy = true,
            highlight = false
        } = options;

        if (!searchIndex) {
            self.postMessage({
                id,
                error: 'Index not built. Call INDEX first.'
            });
            return;
        }

        const queryTokens = tokenize(query);
        const matchedIndices = new Map(); // index -> score

        queryTokens.forEach(queryToken => {
            // 정확 매칭
            if (searchIndex.tokens.has(queryToken)) {
                searchIndex.tokens.get(queryToken).forEach(idx => {
                    matchedIndices.set(idx, (matchedIndices.get(idx) || 0) + 2);
                });
            }

            // 퍼지 매칭 (부분 문자열)
            if (fuzzy) {
                searchIndex.tokens.forEach((indices, token) => {
                    if (token.includes(queryToken) || queryToken.includes(token)) {
                        indices.forEach(idx => {
                            matchedIndices.set(idx, (matchedIndices.get(idx) || 0) + 1);
                        });
                    }
                });
            }
        });

        // 점수 기준 정렬
        let results = Array.from(matchedIndices.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([idx, score]) => ({
                item: searchIndex.items[idx],
                score,
                index: idx
            }));

        // 하이라이트 처리
        if (highlight && query) {
            results = results.map(r => ({
                ...r,
                highlighted: highlightMatches(r.item, query, searchIndex.fields)
            }));
        }

        self.postMessage({
            id,
            result: {
                query,
                total: matchedIndices.size,
                results
            }
        });
    } catch (error) {
        self.postMessage({ id, error: error.message });
    }
}

/**
 * 필터링
 */
function filter(data, id) {
    try {
        const { items, filters } = data;

        const results = items.filter(item => {
            return filters.every(f => {
                const value = getNestedValue(item, f.field);

                switch (f.operator) {
                    case 'eq':
                        return value === f.value;
                    case 'neq':
                        return value !== f.value;
                    case 'gt':
                        return value > f.value;
                    case 'gte':
                        return value >= f.value;
                    case 'lt':
                        return value < f.value;
                    case 'lte':
                        return value <= f.value;
                    case 'contains':
                        return String(value).toLowerCase().includes(String(f.value).toLowerCase());
                    case 'startsWith':
                        return String(value).toLowerCase().startsWith(String(f.value).toLowerCase());
                    case 'endsWith':
                        return String(value).toLowerCase().endsWith(String(f.value).toLowerCase());
                    case 'in':
                        return Array.isArray(f.value) && f.value.includes(value);
                    case 'notIn':
                        return Array.isArray(f.value) && !f.value.includes(value);
                    case 'between':
                        return value >= f.value[0] && value <= f.value[1];
                    case 'isNull':
                        return value === null || value === undefined;
                    case 'isNotNull':
                        return value !== null && value !== undefined;
                    default:
                        return true;
                }
            });
        });

        self.postMessage({
            id,
            result: {
                total: results.length,
                items: results
            }
        });
    } catch (error) {
        self.postMessage({ id, error: error.message });
    }
}

/**
 * 정렬
 */
function sort(data, id) {
    try {
        const { items, sortBy } = data;

        const sorted = [...items].sort((a, b) => {
            for (const s of sortBy) {
                const aVal = getNestedValue(a, s.field);
                const bVal = getNestedValue(b, s.field);

                let comparison = 0;

                if (aVal === null || aVal === undefined) comparison = 1;
                else if (bVal === null || bVal === undefined) comparison = -1;
                else if (typeof aVal === 'string') {
                    comparison = aVal.localeCompare(bVal, 'ko');
                } else {
                    comparison = aVal < bVal ? -1 : (aVal > bVal ? 1 : 0);
                }

                if (comparison !== 0) {
                    return s.direction === 'desc' ? -comparison : comparison;
                }
            }
            return 0;
        });

        self.postMessage({
            id,
            result: sorted
        });
    } catch (error) {
        self.postMessage({ id, error: error.message });
    }
}

/**
 * 집계
 */
function aggregate(data, id) {
    try {
        const { items, groupBy, aggregations } = data;

        const groups = new Map();

        items.forEach(item => {
            const key = groupBy.map(f => getNestedValue(item, f)).join('|');

            if (!groups.has(key)) {
                groups.set(key, {
                    key: groupBy.reduce((acc, f, i) => {
                        acc[f] = getNestedValue(item, f);
                        return acc;
                    }, {}),
                    items: [],
                    aggregates: {}
                });
            }

            groups.get(key).items.push(item);
        });

        // 집계 계산
        groups.forEach(group => {
            aggregations.forEach(agg => {
                const values = group.items.map(item => getNestedValue(item, agg.field)).filter(v => v !== null && v !== undefined);

                switch (agg.type) {
                    case 'count':
                        group.aggregates[agg.alias || `${agg.type}_${agg.field}`] = values.length;
                        break;
                    case 'sum':
                        group.aggregates[agg.alias || `${agg.type}_${agg.field}`] = values.reduce((a, b) => a + Number(b), 0);
                        break;
                    case 'avg':
                        group.aggregates[agg.alias || `${agg.type}_${agg.field}`] = values.length > 0
                            ? values.reduce((a, b) => a + Number(b), 0) / values.length
                            : 0;
                        break;
                    case 'min':
                        group.aggregates[agg.alias || `${agg.type}_${agg.field}`] = Math.min(...values.map(Number));
                        break;
                    case 'max':
                        group.aggregates[agg.alias || `${agg.type}_${agg.field}`] = Math.max(...values.map(Number));
                        break;
                    case 'first':
                        group.aggregates[agg.alias || `${agg.type}_${agg.field}`] = values[0];
                        break;
                    case 'last':
                        group.aggregates[agg.alias || `${agg.type}_${agg.field}`] = values[values.length - 1];
                        break;
                }
            });

            // items 제거 (결과 크기 축소)
            delete group.items;
        });

        self.postMessage({
            id,
            result: Array.from(groups.values())
        });
    } catch (error) {
        self.postMessage({ id, error: error.message });
    }
}

// ========== 유틸리티 함수 ==========

/**
 * 문자열 토큰화
 */
function tokenize(text) {
    if (!text) return [];

    return text
        .toLowerCase()
        .replace(/[^\w\s가-힣]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 0);
}

/**
 * 중첩 객체에서 값 가져오기
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : null;
    }, obj);
}

/**
 * 검색어 하이라이트
 */
function highlightMatches(item, query, fields) {
    const result = { ...item };
    const queryLower = query.toLowerCase();

    fields.forEach(field => {
        const value = getNestedValue(item, field);
        if (value && typeof value === 'string') {
            const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
            setNestedValue(result, field, value.replace(regex, '<mark>$1</mark>'));
        }
    });

    return result;
}

/**
 * 정규식 이스케이프
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 중첩 객체에 값 설정
 */
function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
        if (!current[key]) current[key] = {};
        return current[key];
    }, obj);
    target[lastKey] = value;
}
