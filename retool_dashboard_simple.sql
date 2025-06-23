-- Simplified Historical Lead Time Dashboard Query for Retool
-- Avoids parameter type issues with straightforward approach

with
  BVOrgs as (
    select *
    from "Organization"
    where id in (
      '4a487f4e-6540-4331-ad93-350be16b0f7a',
      '30476d08-0027-48f9-9855-1edd3ccc594a',
      'e95b57db-7a8f-4978-aa1a-3f5358bbb730',
      '8215cdee-abae-4fff-a7d4-892671c86f11',
      'e75bd914-2ab9-4596-995e-521953edd9ef',
      '9feda9be-5e47-4529-9b2b-daa30689c136',
      '36db602d-8d1d-4876-9ebb-31a2d2812c98',
      'e1bacdb5-5855-47f5-ae42-66167e9f2d41',
      '8d235669-b03e-466a-95a5-2e0b38d64d21',
      '00000000-0000-0000-0000-000000000000'
    )
  ),
  BVUsers as (
    select *
    from "User"
    where email ilike '%@buildvision.io'
  ),
  CustomerUsers as (
    select *
    from "User"
    where id not in (select id from BVUsers)
  ),
  CustomerProjects as (
    select *
    from "Project"
    where "orgId" not in (select id from BVOrgs)
  ),
  CustomerPackages as (
    select *
    from "Package"
    where "projectId" in (select id from CustomerProjects)
  ),
  ScopeSheetCostAnswers as (
    select
      *,
      replace(a.answers[1], ',', '')::float as cost
    from "ScopeSheetAnswer" a
    join "ScopeSheetQuestion" q on q.id = a."scopeSheetQuestionId"
    where q.purpose = 'COST'
      and ARRAY_LENGTH(a.answers, 1) > 0
      and "orgId" not in (select id from BVOrgs)
  ),
  ScopeSheetLeadTimeAnswers as (
    select
      *,
      a.answers[1]::float as lead_time_weeks,
      a."updatedAt"::date as answer_date
    from "ScopeSheetAnswer" a
    join "ScopeSheetQuestion" q on q.id = a."scopeSheetQuestionId"
    where (q.purpose = 'LEAD_TIME' or q.purpose = 'SHIPPING_TIME')
      and ARRAY_LENGTH(a.answers, 1) > 0
      and a.answers[1] != ''
      and "orgId" not in (select id from BVOrgs)
  ),
  ScopeSheetManufacturerAnswers as (
    select
      *,
      a.answers[1] as manufacturer
    from "ScopeSheetAnswer" a
    join "ScopeSheetQuestion" q on q.id = a."scopeSheetQuestionId"
    where q.purpose = 'BOD_STATUS'
      and ARRAY_LENGTH(a.answers, 1) > 0
      and a.answers[1] != ''
      and "orgId" not in (select id from BVOrgs)
  ),
  PackageQuoteLeadTimes as (
    select
      "packageQuoteId",
      SUM(lead_time_weeks) as lead_time_weeks,
      MAX(answer_date) as answer_date
    from ScopeSheetLeadTimeAnswers
    group by "packageQuoteId"
  ),
  PackageQuoteManufacturers as (
    select
      "packageQuoteId",
      array_agg(
        distinct
        -- Apply manufacturer standardization
        trim(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    case 
                      when manufacturer = upper(manufacturer) and length(manufacturer) > 2 then
                        initcap(lower(manufacturer))
                      else manufacturer
                    end,
                    '\s+', ' ', 'g'
                  ),
                  '\s*[/&]\s*(ABB\s*)?(VFDs?|Variable\s+Frequency\s+Drives?)\s*$', '', 'gi'
                ),
                '\s*[/&]\s*Franklin\s+Controls?\s*(Starters?)?\s*$', '', 'gi'
              ),
              '\s*\([^)]*\)\s*', ' ', 'g'
            ),
            '\s*-?\s*included\s+in\s+[^$]*\$?\s*$', '', 'gi'
          )
        )
      ) as manufacturer
    from ScopeSheetManufacturerAnswers
    group by "packageQuoteId"
  ),
  PackageQuoteCosts as (
    select "packageQuoteId", MAX(cost) as cost
    from ScopeSheetCostAnswers
    group by "packageQuoteId"
  ),
  PackageLeadTimes as (
    select
      p."projectId" as project_id,
      p.id as package_id,
      p."orgId" as buyer_org_id,
      pq.id as package_quote_id,
      pq."orgId" as seller_org_id,
      pqlt.lead_time_weeks,
      pqlt.answer_date
    from PackageQuoteLeadTimes pqlt
    join "PackageQuote" pq on pq.id = pqlt."packageQuoteId"
    join "Package" p on p.id = pq."packageId"
  ),
  PackageComponentTypes as (
    select
      p.id as package_id,
      array_agg(distinct p_ct.name) as package_type,
      array_agg(distinct dr_ct.name) as equipment_types,
      count(dr) as component_count
    from CustomerPackages p
    join "ComponentType" p_ct on p_ct.id = p."componentTypeId"
    join "DesignRequirement" dr on dr."packageId" = p.id
    join "ComponentType" dr_ct on dr_ct.id = dr."componentTypeId"
    group by p.id
  ),
  ComponentTypeLeadTimes as (
    select *
    from PackageLeadTimes plt
    join PackageComponentTypes pct on pct.package_id = plt.package_id
  ),
  ComponentTypeLeadTimesExpanded as (
    select
      p.name as project_name,
      buyer.name as buyer_name,
      seller.name as seller_name,
      ctlt.package_type,
      ctlt.equipment_types,
      (
        SELECT ARRAY_AGG(combined ORDER BY combined)
        FROM (
          SELECT DISTINCT UNNEST(ctlt.package_type || ctlt.equipment_types) AS combined
        )
      ) as component_types,
      ctlt.component_count,
      ctlt.lead_time_weeks,
      pqm.manufacturer as manufacturer,
      pqc.cost as cost,
      ctlt.answer_date,
      to_char(ctlt.answer_date, 'YYYY-MM') as month_key
    from ComponentTypeLeadTimes ctlt
    join "Project" p on p.id = ctlt.project_id
    join "Organization" buyer on buyer.id = ctlt.buyer_org_id
    join "Organization" seller on seller.id = ctlt.seller_org_id
    join PackageQuoteManufacturers pqm on pqm."packageQuoteId" = ctlt.package_quote_id
    join PackageQuoteCosts pqc on pqc."packageQuoteId" = ctlt.package_quote_id
    where ctlt.lead_time_weeks > 0
      and ctlt.answer_date >= '2024-01-01'::date
  )

-- Simple return structure
select
  project_name,
  buyer_name,
  seller_name,
  component_types,
  component_count,
  lead_time_weeks,
  manufacturer,
  cost,
  answer_date,
  month_key
from ComponentTypeLeadTimesExpanded
order by answer_date desc
limit 2000;
