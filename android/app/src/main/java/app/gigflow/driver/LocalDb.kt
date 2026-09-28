package app.gigflow.driver

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject

/**
 * On-device store for everything the app logs (earnings, expenses, mileage,
 * schedules, GPS breadcrumbs). Rows carry a `clientId` UUID as a stable local
 * identity for edit/delete.
 */
class LocalDb(ctx: Context) : SQLiteOpenHelper(ctx, "gigflow.db", null, 3) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """CREATE TABLE records(
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 client_id TEXT UNIQUE NOT NULL,
                 type TEXT NOT NULL,
                 payload TEXT NOT NULL,
                 created_at INTEGER NOT NULL,
                 synced INTEGER NOT NULL DEFAULT 0
               )""",
        )
        createSchedules(db)
    }

    private fun createSchedules(db: SQLiteDatabase) {
        db.execSQL(
            """CREATE TABLE IF NOT EXISTS schedules(
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 client_id TEXT UNIQUE NOT NULL,
                 payload TEXT NOT NULL,
                 synced INTEGER NOT NULL DEFAULT 0
               )""",
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, old: Int, new: Int) {
        if (old < 2) createSchedules(db)
    }

    data class Row(
        val id: Long,
        val clientId: String,
        val type: String,
        val payload: JSONObject,
        val createdAt: Long,
        val synced: Boolean,
    )

    fun insert(type: String, payload: JSONObject): Row {
        val clientId = java.util.UUID.randomUUID().toString()
        payload.put("type", type)
        payload.put("clientId", clientId)
        val cv = ContentValues().apply {
            put("client_id", clientId)
            put("type", type)
            put("payload", payload.toString())
            put("created_at", System.currentTimeMillis())
            put("synced", 0)
        }
        val id = writableDatabase.insert("records", null, cv)
        return Row(id, clientId, type, payload, System.currentTimeMillis(), false)
    }

    fun all(limit: Int = 100): List<Row> =
        query("SELECT * FROM records ORDER BY created_at DESC LIMIT $limit")

    /** Updates the payload of a record — keeps the same clientId. */
    fun update(clientId: String, type: String, payload: JSONObject) {
        payload.put("type", type)
        payload.put("clientId", clientId)
        writableDatabase.execSQL(
            "UPDATE records SET type = ?, payload = ?, synced = 0 WHERE client_id = ?",
            arrayOf(type, payload.toString(), clientId),
        )
    }

    fun delete(clientId: String) {
        writableDatabase.execSQL("DELETE FROM records WHERE client_id = ?", arrayOf(clientId))
    }

    fun get(clientId: String): Row? =
        query("SELECT * FROM records WHERE client_id = ?", arrayOf(clientId)).firstOrNull()

    private fun query(sql: String, args: Array<String>? = null): List<Row> {
        val out = mutableListOf<Row>()
        readableDatabase.rawQuery(sql, args).use { c ->
            while (c.moveToNext()) {
                out.add(Row(
                    id = c.getLong(0),
                    clientId = c.getString(1),
                    type = c.getString(2),
                    payload = JSONObject(c.getString(3)),
                    createdAt = c.getLong(4),
                    synced = c.getInt(5) == 1,
                ))
            }
        }
        return out
    }

    private fun query(sql: String): List<Row> = query(sql, null)

    // ---- schedule entries ----

    data class Sched(val clientId: String, val payload: JSONObject, val synced: Boolean)

    fun insertSchedule(payload: JSONObject): Sched {
        val clientId = java.util.UUID.randomUUID().toString()
        payload.put("clientId", clientId)
        writableDatabase.execSQL(
            "INSERT INTO schedules(client_id, payload, synced) VALUES(?,?,0)",
            arrayOf(clientId, payload.toString()),
        )
        return Sched(clientId, payload, false)
    }

    fun schedules(): List<Sched> {
        val out = mutableListOf<Sched>()
        readableDatabase.rawQuery(
            "SELECT client_id, payload, synced FROM schedules ORDER BY id ASC", null,
        ).use { c ->
            while (c.moveToNext()) out.add(Sched(c.getString(0), JSONObject(c.getString(1)), c.getInt(2) == 1))
        }
        return out
    }

    fun deleteSchedule(clientId: String) {
        writableDatabase.execSQL("DELETE FROM schedules WHERE client_id = ?", arrayOf(clientId))
    }

    /** Local aggregates. */
    fun totals(sinceMs: Long): Totals = stats(sinceMs).let {
        Totals(it.earnedCents, it.spentCents, it.km)
    }

    /** Richer aggregates for the analytics tab: hours, tips, record counts. */
    fun stats(sinceMs: Long): Stats {
        var earned = 0; var spent = 0; var km = 0.0
        var hours = 0.0; var tips = 0; var jobs = 0
        readableDatabase.rawQuery(
            "SELECT type, payload FROM records WHERE created_at >= ?", arrayOf(sinceMs.toString()),
        ).use { c ->
            while (c.moveToNext()) {
                val p = JSONObject(c.getString(1))
                when (c.getString(0)) {
                    "earning" -> {
                        earned += p.optInt("amountCents")
                        tips += p.optInt("tipCents")
                        hours += p.optDouble("hours")
                        jobs++
                    }
                    "expense" -> spent += p.optInt("amountCents")
                    "mileage" -> km += p.optDouble("distanceKm")
                }
            }
        }
        return Stats(earned, spent, km, hours, tips, jobs)
    }

    /** Per-day gross cents for the last [days] days (index 0 = oldest). */
    fun dailyGross(days: Int): FloatArray {
        val out = FloatArray(days)
        val cal = java.util.Calendar.getInstance()
        readableDatabase.rawQuery(
            "SELECT created_at, payload FROM records WHERE type = 'earning'", null,
        ).use { c ->
            while (c.moveToNext()) {
                val at = c.getLong(0)
                val d = java.util.Calendar.getInstance().apply { timeInMillis = at }
                val age = dayDiff(d, cal)
                if (age in 0 until days) out[days - 1 - age] += JSONObject(c.getString(1)).optInt("amountCents")
            }
        }
        return out
    }

    private fun dayDiff(a: java.util.Calendar, b: java.util.Calendar): Int {
        fun days(c: java.util.Calendar) = c.get(java.util.Calendar.YEAR) * 400 + c.get(java.util.Calendar.DAY_OF_YEAR)
        return days(b) - days(a)
    }

    data class Totals(val earnedCents: Int, val spentCents: Int, val km: Double)
    data class Stats(
        val earnedCents: Int, val spentCents: Int, val km: Double,
        val hours: Double, val tipCents: Int, val jobs: Int,
    )
}
